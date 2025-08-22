import Fuse from 'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.mjs';
import { itemRename } from "../data/remaster.js"
import CONSTANTS from "../data/global.js"

const hloiVer = "v0.2.6"

let hlodebug = false;
const color1 = 'color: #7bf542';  //bright green
const color2 = 'color: #d8eb34'; //yellow green
const color3 = 'color: #ffffff'; //white
const color4 = 'color: #cccccc'; //gray
const color5 = 'color: #ff0000'; //red
var HeroLab, userToken;
var HeroLabButton = true;


var characterExport;

console.log('HeroLab-Importer | Hello World!');

Hooks.on('ready', async function () {
  if (game.system.id != "pf2e") {
    console.log("%cHeroLab Importer | %cWrong game system. %cNot enabling.", color1, color5, color4);
  } else {
    //console.log("%cHeroLab Importer | %cinitializing",color1,color4);
    game.settings.register('herolab-importer', 'userToken', {
      name: "User Token",
      hint: "Please enter your personal user token. A user token allows external tools (like this one) to access the Hero Lab server and perform export operations.\
                \nThis should be the GMs user token if using a Campaign in Hero Lab.",
      scope: "world",
      config: true,
      type: String,
      default: '',
      restricted: true,
      onChange: value => (userToken = value)
    });
    game.settings.register('herolab-importer', 'debugEnabled', {
      name: "Enable debug mode",
      hint: "Debug output will be written to the js console.",
      scope: "client",
      config: true,
      type: Boolean,
      default: false,
      onChange: value => (hlodebug = value)
    });
    game.settings.register('herolab-importer', 'elementToken', {
      name: "Element Token",
      hint: "Please enter your character's element token. This is how we will import your character. If you plan to import multiple characters, leave this blank.",
      scope: 'client',
      config: true,
      type: String,
      default: '',
    });
    game.settings.register('herolab-importer', 'importEquipment', {
      name: "Import Equipment",
      scope: "client",
      config: false,
      type: Boolean,
      default: true,
    });
    game.settings.register('herolab-importer', 'importSpells', {
      name: "Import Spells",
      scope: "client",
      config: false,
      type: Boolean,
      default: true,
    });
    game.settings.register('herolab-importer', 'importFeats', {
      name: "Import Feats",
      scope: "client",
      config: false,
      type: Boolean,
      default: true,
    });
    game.settings.register('herolab-importer', 'importSkills', {
      name: "Import Skills",
      scope: "client",
      config: false,
      type: Boolean,
      default: true,
    });
    game.settings.register('herolab-importer', 'importWealth', {
      name: "Import Wealth",
      scope: "client",
      config: false,
      type: Boolean,
      default: true,
    });
  }
  hlodebug = game.settings.get('herolab-importer', 'debugEnabled');
  userToken = game.settings.get('herolab-importer', 'userToken');
  HeroLab = new HeroLabImporter(hlodebug);
});

Hooks.on('renderActorSheet', function (obj, html) {
  hlodebug = game.settings.get('herolab-importer', 'debugEnabled');
  if (game.system.id != "pf2e") {
    console.log("%cHeroLab Importer | %cWrong game system. %cNot adding HeroLab button to actor sheet.", color1, color5, color4);
  } else {
    // Only inject the link if the actor is of type "character" and the user has permission to update it
    const actor = obj.actor;

    if (!(actor.type === "character")) { return; }
    if (actor.canUserModify(game.user, "update") == false) { return; }

    if (HeroLabButton) {
      let element = html.find(".window-header .window-title");
      if (element.length != 1) { return; }

      let button = $(`<a class="popout" style><i class="fas fa-flask"></i>HeroLab</a>`);
      userToken = game.settings.get('herolab-importer', 'userToken');
      if (hlodebug) {
        console.log("%cHeroLab Importer | %cherolab-importer token: " + userToken, color1, color4);
      }
      button.on('click', () => HeroLab.beginHeroLabImport(obj.object, userToken));
      element.after(button);
    }
  }
}
);

export class HeroLabImporter {
  constructor(hlodebug) {
    this.hlodebug = hlodebug;
    this.itemsNotAdded = [];
    this.spellsNotAdded = [];
    this.classTrait = '';
    this.importEquipment = game.settings.get('herolab-importer', 'importEquipment');
    this.importSpells = game.settings.get('herolab-importer', 'importSpells');
    this.importFeats = game.settings.get('herolab-importer', 'importFeats');
    this.importSkills = game.settings.get('herolab-importer', 'importSkills');
    this.importWealth = game.settings.get('herolab-importer', 'importWealth');

    this.debugMatch = {
      Ancestry: {},
      Heritage: {},
      Background: {},
      Class: {},
      Feats: [],
      Equipment: [],
      Spells: [],
    };

  }

  async beginHeroLabImport(targetActor, userToken) {
    //Clear out the used arrays
    this.debugMatch.Spells = [];
    this.debugMatch.Feats = [];
    this.debugMatch.Equipment = [];
    this.itemsNotAdded = [];
    this.spellsNotAdded = [];

    window.testActor = targetActor;
    HeroLabImporter.log(this.hlodebug, 'Starting HeroLabImport')

    let importCharacter = false;
    let elementToken = game.settings.get('herolab-importer', 'elementToken');

    //Dialog to get starting information
    await Dialog.wait({
      title: `Herolab Online Import`,
      content: `
        <div>
          <p>Step 1: Get the character token by clicking on the kebab menu (<strong>⋮</strong>) on any character on your account. Scroll down to "Element Token" and click the <strong>Get Element Token</strong> button. Click the <strong>Copy to Clipboard</strong> button.</p>
          <p>Step 2: Paste the Element Token from the Herolab Online export dialog below</p>
          <p><strong>Please change input method for attributes to "Manual Entry" before you continue! That is currently the only input method supported by the importer.</strong></p>
          <br>
          <p>Please note - items which cannot be matched to the Foundry database will not be imported!<p>
        </div>
        <hr/>
        <div id="divCode">
          Enter the element token of the character you wish to import<br>
          <div id="divOuter">
            <div id="divInner">
              <input id="textBoxElementID" type="text" maxlength="14" value=${elementToken} />
            </div>
          </div>
        </div>
        <hr/>
        <div>
          <p><input id="importEquipment" type="checkbox" ${this.importEquipment ? 'checked' : ''} />
          <label for="importEquipment"><strong>Import Equipment:</strong> This is destructive!! Replace ALL equipment with what is in Hero Lab Online. (Recommended for new import only!)</label></p>
          <p><input id="importSkills" type="checkbox" ${this.importSkills ? 'checked' : ''} />
          <label for="importSkills"><strong>Import Skills:</strong> Update all skills from Hero Lab Online.</label></p>
          <p><input id="importFeats" type="checkbox" ${this.importFeats ? 'checked' : ''} />
          <label for="importFeats"><strong>Import Feats:</strong> Update all Feats from Hero Lab Online. Best guess for feat types. Recommend you double check.</label></p>
          <p><input id="importSpells" type="checkbox" ${this.importSpells ? 'checked' : ''} />
          <label for="importSpells"><strong>Import Spells:</strong> Update all Spells from Hero Lab Online. Best guess for spell lists. Recomment you double check.</label></p>
          <p><input id="importWealth" type="checkbox" ${this.importWealth ? 'checked' : ''} />
          <label for="importWealth"><strong>Import Wealth:</strong> Update actor wealth. This will remove ALL existing coins in inventory!!</label></p>
        </div>
        <hr/>
        <br><br><strong>Once you click Import, please be patient as the process might take up to 45 seconds to complete.</strong><br><br>
        <style>
        
          #textBoxElementID {
              border: 0px;
              padding-left: 5px;
              letter-spacing: 2px;
              width: 330px;
              min-width: 330px;
            }
            
            #divInner{
              left: 0;
              position: sticky;
            }
            
            #divOuter{
              width: 285px; 
              overflow: hidden;
            }
    
            #divCode{  
              border: 1px solid black;
              width: 300px;
              margin: 0 auto;
              padding: 5px;
            }
    
        </style>
        `,
      buttons: {
        yes: {
          icon: "<i class='fas fa-check'></i>",
          label: `Import`,
          //callback: () => importCharacter = true
          callback: (html) => {
            importCharacter = true;
            elementToken = html.find('[id="textBoxElementID"]')[0].value;
            this.importEquipment = html.find('[id="importEquipment"]')[0].checked;
            this.importSkills = html.find('[id="importSkills"]')[0].checked;
            this.importFeats = html.find('[id="importFeats"]')[0].checked;
            this.importSpells = html.find('[id="importSpells"]')[0].checked;
            this.importWealth = html.find('[id="importWealth"]')[0].checked;
            game.settings.set('herolab-importer', 'importEquipment', this.importEquipment);
            game.settings.set('herolab-importer', 'importSkills', this.importSkills);
            game.settings.set('herolab-importer', 'importFeats', this.importFeats);
            game.settings.set('herolab-importer', 'importSpells', this.importSpells);
            game.settings.set('herolab-importer', 'importWealth', this.importWealth);
          }
        },
        no: {
          icon: "<i class='fas fa-times'></i>",
          label: `Cancel`,
        },
      },
      default: "yes",
      close: html => {
        HeroLabImporter.log(hlodebug, "Cancelling Importer.");
        return true;
      }
    });

    //Get the export
    if (importCharacter) {
      characterExport = await this.getHeroLabExport(userToken, elementToken);

      if (characterExport) {
        importCharacter = await Dialog.confirm({
          title: "Confirm Import",
          content: `<p>You are about to import ${characterExport.actors['actor.1'].name}. Please confirm.</p>
                    <br>
                    <p>Please note: this cannot be undone!!<p>`,
          yes: () => importCharacter = true,
          no: () => importCharacter = false,
          defaultYes: false
        });
      }
      else {
        importCharacter = false;
      }

    }

    //Import the main Character
    if (importCharacter) {
      await this.importActorGameValues(targetActor, characterExport.actors['actor.1']);
      this.displayChangesDialog();
    }



    targetActor.sheet.render()
  }

  displayChangesDialog() {
    let content = `<div class="changes">`
    for (let [section, data] of Object.entries(this.debugMatch)) {
      content += `<div><header class="bold">${section}</header>`
      if (!Array.isArray(data)) {
        content += `<p class="tab">${data.import} -> `
        content += `<a class="content-link" draggable="true" data-link data-uuid="${data.export.uuid}" data-type="Item"><i class="fas fa-suitcase"></i>${data.export.name}</a></p>`
      }
      else {
        for (let item of data) {
          content += `<p class="tab">${item.import.name} -> `
          content += `<a class="content-link" draggable="true" data-link data-uuid="${item.export.uuid}" data-type="Item"><i class="fas fa-suitcase"></i>"${item.export.name}"</a></p>`
        }
      }
      content += `</div>`
    }
    content += `</div>
    <style>
      .changes {
        overflow-y: scroll;
        height: 800px;
        width: 500;
      }
      p.tab { margin-left: 30px; }
      .bold { font-weight: bold; }
    </style>`

    new Dialog({
      window: { title: "Changes made to actor" },
      content: content,
      buttons: [{
        action: "ok",
        label: "OK",
        default: true,
      }],
    }).render({ force: true });
  }

  async getHeroLabExport(userToken, elementToken) {
    let charExport;

    HeroLabImporter.log(this.hlodebug, 'Getting export from Hero Lab Online');
    const accessToken = await this.getHeroLabAccessToken(userToken);

    if (!accessToken) return null;

    //Fetch the character Export
    await foundry.utils.fetchJsonWithTimeout("https://api.herolab.online/v1/character/get", {
      method: "POST",
      body: JSON.stringify({
        accessToken: accessToken,
        elementToken: elementToken
      }),
      headers: {
        "Content-type": "application/json; charset=UTF-8"
      }
    })
      .then((response) => {
        charExport = response
      })
      .catch((error) => {
        console.error("%cHeroLab Importer | %cUnable to import HeroLab JSON! Error: " + error, color1, color4)
      });

    HeroLabImporter.log(this.hlodebug, "Character JSON: " + charExport);

    window.charExport = charExport;

    if (charExport?.error) {
      console.error("%cHeroLab Importer | %cUnable to import HeroLab JSON! Error: " + charExport.error, color1, color4)
      return undefined;
    }
    else {
      return charExport.export;
    }

  }

  async getHeroLabAccessToken(userToken) {
    HeroLabImporter.log(this.hlodebug, 'Getting access token from Hero Lab Online ');

    //Fetch the access token
    const response = await foundry.utils.fetchJsonWithTimeout("https://api.herolab.online/v1/access/acquire-access-token", {
      method: "POST",
      body: JSON.stringify({
        refreshToken: userToken,
        toolName: "Importer",
        lifespan: 0
      }),
      headers: {
        "Content-type": "application/json; charset=UTF-8"
      }
    })
      .catch((error) => {
        Dialog.prompt({
          content: `<p>Failed to get the Access Token from Hero Labs Online.</p>
                    <p>Please make sure the GM has entered their 'User Token' in the appropriate spot in the module settings.</p>`
        });
      });

    return response?.accessToken
  }

  async importActorGameValues(targetActor, characterActorExport) {
    //Get all the items from Export
    let exportItems = this.getItemsFromActor(characterActorExport);

    //Update Name
    if (!(targetActor.name === characterActorExport.name)) {
      targetActor.update({ 'name': characterActorExport.name }, { render: false });
      targetActor.update({ 'prototypeToken.name': characterActorExport.name }, { render: false });
      HeroLabImporter.log(this.hlodebug, 'Updating Actor Name to ' + characterActorExport.name);
    }

    //Set Ancestry
    if (characterActorExport.gameValues?.actRace) {
      let importAncestry = characterActorExport.gameValues.actRace
      let pf2eAncestry = await this.findItem("pf2e.ancestries", importAncestry);
      //Can't find Ancestry? Try again with only first word
      if (!pf2eAncestry) pf2eAncestry = await this.findItem("pf2e.ancestries", importAncestry.split(" ")[0]);
      if (!(pf2eAncestry?.name === targetActor.ancestry?.name))
        await targetActor.createEmbeddedDocuments('Item', [pf2eAncestry], { render: false });

      this.debugMatch.Ancestry = { import: importAncestry, export: pf2eAncestry };
    }

    //Update Background
    if (characterActorExport.gameValues?.actBackgroundText) {
      let importBackground = characterActorExport.gameValues.actBackgroundText;
      let pf2eBackground = await this.findItem("pf2e.backgrounds", importBackground);
      if (!(pf2eBackground?.name === targetActor.background?.name))
        await targetActor.createEmbeddedDocuments('Item', [pf2eBackground.toObject()], { render: false });

      this.debugMatch.Background = { import: importBackground, export: pf2eBackground };
    }

    //Update Heritage
    if (exportItems['heritage'][0]?.name) {
      let pf2eHeritage = await this.findItem("pf2e.heritages", exportItems['heritage'][0].name);
      if (!(pf2eHeritage?.name === targetActor.heritage?.name))
        await targetActor.createEmbeddedDocuments('Item', [pf2eHeritage.toObject()], { render: false });

      this.debugMatch.Heritage = { import: exportItems['heritage'][0].name, export: pf2eHeritage };
    }

    //Update Deity
    if (exportItems['deity'][0]?.name) {
      let pf2eDeity = await this.findItem("pf2e.deities", exportItems["deity"][0].name)
      if (!(pf2eDeity?.name === targetActor.deity?.name))
        await targetActor.createEmbeddedDocuments('Item', [pf2eDeity.toObject()], { render: false });

      this.debugMatch.Deity = { import: exportItems["deity"][0].name, export: pf2eDeity };
    }

    //Update Level
    await targetActor.update({ "system.details.level.value": characterActorExport.gameValues.actLevelNet });
    HeroLabImporter.log(this.hlodebug, 'Updating Actor Level to ' + characterActorExport.gameValues.actLevelNet);

    //Update Class
    if (exportItems['class'][0]?.name) {
      let pf2eClass = await this.findItem("pf2e.classes", exportItems['class'][0].name);
      this.classTrait = exportItems['class'][0].Trait;

      if (!(pf2eClass?.name === targetActor.class?.name)) {
        const choiceHook = Hooks.on('renderChoiceSetPrompt', function (choicePrompt) {
          if (HeroLabImporter.checkChoiceSetPrompt(exportItems, choicePrompt)) {
            choicePrompt.close();
          }
        });

        await targetActor.createEmbeddedDocuments('Item', [pf2eClass.toObject()], { render: false });


        for (let [k, choice] of Object.entries(ui.windows)) {
          if (choice?.selection) choice.close();
        }

        Hooks.off('renderChoiceSetPrompt', choiceHook);
      }

      this.debugMatch.Class = { import: exportItems['class'][0].name, export: pf2eClass };
    }

    //Update Actor Attributes
    await this.updateActorAttributes(targetActor, exportItems['abilityScore']);

    //Update Actor Equipment
    if (this.importEquipment) await this.updateActorEquipment(targetActor, exportItems['gear']);

    //Update Actor Weapons
    if (this.importEquipment) await this.updateActorWeapons(targetActor, exportItems['weapon']);

    //Update Actor Armor
    if (this.importEquipment) await this.updateActorArmor(targetActor, exportItems['armor']);

    //Update Actor Wealth
    if (this.importWealth) await this.updateActorWealth(targetActor, characterActorExport.gameValues?.actMoneyNet);

    //Set Languages
    await this.updateActorLanguages(targetActor, exportItems['language']);

    //Update Actor Feats
    if (this.importFeats) await this.updateActorFeats(targetActor, exportItems['feat']);

    //Update Actor Skills
    if (this.importSkills) await this.updateActorSkills(targetActor, exportItems['skill']);

    //Update Actor Spells
    if (this.importSpells) await this.updateActorSpells(targetActor, exportItems);


    //List all the things we couldn't add
    HeroLabImporter.log(this.hlodebug, "Couldn't add these items: " + this.itemsNotAdded);
    HeroLabImporter.log(this.hlodebug, "Couldn't add these spells: " + this.spellsNotAdded);

    targetActor.update({
      //  "flags.exportSource.world": game.world.id,
      //  "flags.exportSource.system": game.system.id,
      // "flags.exportSource.systemVersion": game.system.version,
      //  "flags.exportSource.coreVersion": game.version,
      "flags.herolabimporter.version.value": hloiVer,
    });

    if (hlodebug) {
      console.log("%cHeroLab Importer | %cMatched items:", color1, color4, this.debugMatch);

    }

  }

  async findItem(packName, itemName) {
    //Locates an item in the packName pack. Goes for a close match and chooses the best one.

    let pack = game.packs.get(packName);

    let fuse = new Fuse([], {
      keys: ["name"],
      includeScore: true,
      threshold: 0.2,
    });

    for (const doc of pack.index) {
      fuse.add(doc)
    }
    let results = fuse.search(itemName);
    const myItem = await pack.getDocument(results[0]?.item._id)

    return myItem;
  }

  static checkChoiceSetPrompt(exportItems, choicePrompt) {

    for (let [index, choice] of Object.entries(choicePrompt.choices)) {
      for (let [k, ability] of Object.entries(exportItems['ability'])) {
        //if(choice.label.startsWith(ability.name)) {
        //I don't like this
        if (choice.label === ability.name) {
          choicePrompt.selection = choicePrompt.choices.at(Number(index));

          exportItems['ability'].splice(k, 1);
          return true;
        }
      }
      for (let [k, feat] of Object.entries(exportItems['feat'])) {
        if (feat.name.startsWith(choice.label)) {
          choicePrompt.selection = choicePrompt.choices.at(Number(index));

          exportItems['feat'].splice(k, 1);
          return true;
        }
      }
    }
    return false;
  }

  processHerolabItemList(hlitems) {
    for (let hlitem in hlitems) {
      hlitems[hlitem].base = hlitem.substring(2, hlitem.indexOf("."));
    }
  }

  getItemsFromActor(characterActorExport) {
    //Separate out all the items from the export into a managable structure.

    let items = {
      'ability': [], 'armor': [], 'abilityScore': [], 'class': [], 'deity': [], 'feat': [], 'focus': [],
      'gear': [], 'heritage': [], 'language': [], 'movement': [], 'naturalWeapon': [], 'reserve': [],
      'skill': [], 'save': [], 'staff': [], 'spell': [], 'spellbook': [], 'weapon': []
    }

    this.processHerolabItemList(characterActorExport.items);
    for (let item in characterActorExport.items) {
      switch (item.substring(0, 2)) {
        case 'ab':
          items['ability'].push(characterActorExport.items[item]);
          break;
        case 'ar':
          items['armor'].push(characterActorExport.items[item]);
          break;
        case 'as':
          items['abilityScore'].push(characterActorExport.items[item]);
          break;
        case 'cl':
          items['class'].push(characterActorExport.items[item]);
          break;
        case 'de':
          items['deity'].push(characterActorExport.items[item]);
          break;
        case 'ft':
          items['feat'].push(characterActorExport.items[item]);
          break;
        case 'fs':
          items['focus'].push(characterActorExport.items[item]);
          break;
        case 'gr':
          items['gear'].push(characterActorExport.items[item]);
          if (characterActorExport.items[item].compset == 'Spellbook')
            items['spellbook'].push(characterActorExport.items[item]);
          break;
        case 'hr':
          items['heritage'].push(characterActorExport.items[item]);
          break;
        case 'ln':
          items['language'].push(characterActorExport.items[item].name);
          break;
        case 'mv':
          items['movement'].push(characterActorExport.items[item]);
          break;
        case 'nw':
          items['naturalWeapon'].push(characterActorExport.items[item]);
          break;
        case 'rv':
          items['reserve'].push(characterActorExport.items[item]);
          break;
        case 'sk':
          items['skill'].push([item, characterActorExport.items[item]]);
          break;
        case 'sv':
          items['save'].push(characterActorExport.items[item]);
          break;
        case 'sf':
          items['staff'].push(characterActorExport.items[item]);
          break;
        case 'sp':
          items['spell'].push(characterActorExport.items[item]);
        case 'wp':
          items['weapon'].push(characterActorExport.items[item]);
          break;
      }
    }

    return items;
  }

  async updateActorAttributes(targetActor, exportAttributes) {
    //Abbilities by manual
    await targetActor.update({ "system.build.attributes.manual": true }, { render: true });
    if (targetActor.system.build.attributes.manual) {
      for (let [k, ability] of Object.entries(exportAttributes)) {
        let update = ability?.stAbScModifier || 0;
        targetActor.update({ [`system.abilities.${CONSTANTS.ABILITY_LOOKUP[ability.name]}.mod`]: update });
      }
    };
    //Abbilities by boosting 
    //TODO: This doesn't work yet.
    /*
    else {
      const boosts = {
        "Charisma": 0,
        "Constitution": 0,
        "Dexterity": 0,
        "Intelligence": 0,
        "Strength": 0,
        "Wisdon": 0,
      }
    };
    */
  }

  async updateActorLanguages(targetActor, exportLanguage) {
    //Gets the languages and filter's out the ones they already have

    const mergeLanguages = true;
    const ancestryLanguages = targetActor.ancestry?.system.languages?.value || [];

    if (mergeLanguages) {
      exportLanguage = [...new Set([...exportLanguage.map((l) => l.toLowerCase()), ...targetActor.system.details.languages.value.map((l) => l.toLowerCase())])];
    };

    const intLanguages = exportLanguage
      .filter((l) => !ancestryLanguages.includes(l.toLowerCase()))
      .map((l) => l.toLowerCase());


    await targetActor.update({ "system.details.languages.value": intLanguages }, { render: false });
    HeroLabImporter.log(this.hlodebug, "Updating Languages: " + intLanguages);
  }

  async updateActorSkills(targetActor, exportSkill) {
    //Updates all the skill proficiency values

    HeroLabImporter.log(this.hlodebug, "Updating the skills")
    const exportLore = []
    for (let [key, skill] of exportSkill) {
      //Get the Lore skills for later
      if (key.startsWith("skLore")) {
        exportLore.push(skill);
        continue;
      }

      //Set the skill proficiency. Foundry does the rest for me!
      let setting = `system.skills.${skill.name.toLowerCase()}.rank`;
      await targetActor.update({ [setting]: CONSTANTS.PROF_LOOKUP[skill.ProfLevel] }, { render: false });
    }

    //Remove existing Lore, because I guess it easier? Why did I do this?
    //TODO: Can we, maybe, just check if they already have the Lore?
    for (const [key, skill] of Object.entries(targetActor.system.skills)) {
      if (skill.lore) {
        targetActor.deleteEmbeddedDocuments('Item', [skill.itemID]);
      };
    };

    //Add the Lore skills
    var lores = [];
    for (const lore of exportLore) {
      const data = {
        name: lore.name,
        type: "lore",
        system: {
          proficient: {
            value: CONSTANTS.PROF_LOOKUP[lore.ProfLevel],
          },
          featType: "",
          mod: {
            value: 0,
          },
          item: {
            value: 0,
          },
        },
      };
      lores.push(data);
    }

    const newLores = foundry.utils.deepClone(lores);

    await targetActor.createEmbeddedDocuments("Item", newLores, { keepId: true, render: false });
    HeroLabImporter.log(this.hlodebug, "Updating Lore");
  }

  async updateActorFeats(targetActor, exportFeat) {
    const featItems = [];
    const slugs = [];
    const slots = { 'ancestry': [], 'class': [], 'archetype': [], 'skill': [], 'general': [] };

    HeroLabImporter.log(this.hlodebug, "Updating Feats")

    //Get empty feat slots
    for (let [key, value] of targetActor.feats.entries()) {
      for (let [k, v] of Object.entries(value.slots)) {
        if (!v?.feat) { slots[key].push(k) }
      }
    }

    //Find all the Feats from Compendium
    for (let [key, feat] of Object.entries(exportFeat)) {
      let newFeat = await this.findItem("pf2e.feats-srd", feat.name);
      //Try again without parenthesis
      if (!newFeat) {
        newFeat = await this.findItem("pf2e.feats-srd", feat.name.replace(/\s*\(.*?\)\s*/g, ''))
      }

      if (newFeat) {
        featItems.push(newFeat);
        this.debugMatch.Feats.push({ import: feat, export: newFeat });
      }
      else {
        this.itemsNotAdded.push(feat.name);
      }
    };

    //Sort feats by level
    featItems.sort((a, b) => a.system.level.value - b.system.level.value);
    for (let [key, value] of Object.entries(featItems)) {
      //If they don't have the feat, add it
      if (!targetActor.itemTypes.feat.find(feat => feat.system.slug === value.system.slug)) {
        let category = value.system.category
        if (value.system.traits.value.includes('archetype'))
          category = 'archetype'
        let slot = slots[category].shift();
        await targetActor.feats.insertFeat(value, { groupId: category, slotId: slot });
      }
    }

    HeroLabImporter.log(this.hlodebug, "Bro...I did what I could for the feats.");
  }

  async updateActorEquipment(targetActor, exportGear) {
    //Adds all gear
    let refreshAllEquipment = true;

    //Clear all items from Actor
    if (refreshAllEquipment) {
      var items = targetActor.inventory.contents.filter((item) => !item.isCoinage);
      items = items.map((item) => item.id);
      targetActor.deleteEmbeddedDocuments("Item", items, { render: false });
    }

    HeroLabImporter.log(this.hlodebug, "Importing Gear")
    await this.addActorItems(targetActor, exportGear)

  }

  async updateActorArmor(targetActor, exportArmor) {
    //Adds the armor
    HeroLabImporter.log(this.hlodebug, "Importing Armor")
    this.addActorItems(targetActor, exportArmor);
  }

  async updateActorWeapons(targetActor, exportWeapon) {
    //Adds the weapons
    HeroLabImporter.log(this.hlodebug, "Importing weapons")
    exportWeapon = exportWeapon.filter((l) => l?.grBulk)
    await this.addActorItems(targetActor, exportWeapon);
  }

  async updateActorWealth(targetActor, exportWealth) {
    const coins = { cp: 0, sp: 0, gp: 0, pp: 0 };

    await targetActor.inventory.removeCoins(targetActor.inventory.coins);

    HeroLabImporter.log(hlodebug, "Updating wealth");
    for (let coinStr of exportWealth.split(', ')) {
      let coinVal = coinStr.trim().split(' ')
      coins[coinVal[1]] = coinVal[0].replace(',', '');
    }

    await targetActor.inventory.addCoins(coins);
  }

  async addActorItems(targetActor, exportGear, container = undefined) {
    //Adds gear with ?container
    var gearItem;

    for (var [key, value] of Object.entries(exportGear)) {
      if (!(value.compset == 'Spell' || value.compset == 'WeaponTrait' || value.compset == 'ArmorTrait')) {
        gearItem = await this.findItem("pf2e.equipment-srd", value.name);
        //Nothing found, try removing ending parenthetic word
        if (!gearItem) {
          gearItem = await this.findItem("pf2e.equipment-srd", value.base);
        }
        if (!gearItem) {
          gearItem = await this.findItem("pf2e.equipment-srd", value.name.replace(/\s*\(.*?\)\s*/g, ''));
          if (!gearItem) {
            if (CONSTANTS.EQUIPMENT_LOOKUP[value.name]) {
              gearItem = await this.findItem("pf2e.equipment-srd", CONSTANTS.EQUIPMENT_LOOKUP[value.name]);
            }
          }
        }
        if (gearItem) {
          //var addedItem = await targetActor.createEmbeddedDocuments('Item',[gearItem.toObject()], {render: false})
          var addedItem = await targetActor.addToInventory(gearItem, container);

          if (value?.items) {
            this.processHerolabItemList(value.items)
            if (value.compset == 'Weapon') {
              await this.updateWeaponRune(targetActor, value.items, addedItem);
            } else if(value.compset == 'Armor') {
              await this.updateArmorRune(targetActor, value.items, addedItem);
            } else {
              await this.addActorItems(targetActor, value.items, addedItem)
            }
          }
          if (value?.stackQty) {
            await this.updateItemQuantity(targetActor, addedItem, value.stackQty);
          }
          this.debugMatch.Equipment.push({ import: value, export: gearItem });
        }
        else {
          this.itemsNotAdded.push(value.name);
        }
      }
    }
  }

async updateArmorRune(targetActor, gearItems, armor) {
    var gearItem;

    for (var [key, value] of Object.entries(gearItems)) {
      if (value.compset == 'Rune') {
        var potencyRuneValue = CONSTANTS.FUNDAMENTAL_RUNE_ARMOR_POTENCY[value.base];
        if (potencyRuneValue > 0) {
          armor.update({ "system.runes.potency": potencyRuneValue });
          HeroLabImporter.log(this.hlodebug, `Adding Potency Rune ${potencyRuneValue} to ${armor.name}`);
        }
        var resilientRuneValue = CONSTANTS.FUNDEMENTAL_RUNE_ARMOR_RELILIENT[value.base];
        //Verify Resilient
        if (resilientRuneValue > 0) {
          armor.update({ "system.runes.resilient": resilientRuneValue });
          HeroLabImporter.log(this.hlodebug, `Adding Resilient Rune ${resilientRuneValue} to ${armor.name}`);
        }
        //Verify Property
        if (!potencyRuneValue && !resilientRuneValue) {
          var propertyRune = await this.findItem("pf2e.equipment-srd", value.name);
          if (propertyRune) {
            armor.system.runes.property.push(propertyRune.system.slug);
            armor.update({ "system.runes.property": armor.system.runes.property });
            HeroLabImporter.log(this.hlodebug, `Adding Property Rune ${propertyRune.name} to ${armor.name}`);

          }
      }
    }
  }
}

  async updateWeaponRune(targetActor, gearItems, weapon) {
    var gearItem;

    for (var [key, value] of Object.entries(gearItems)) {
      if (value.compset == 'Rune') {
        //Verify Potency
        var potencyRuneValue = CONSTANTS.FUNDAMENTAL_RUNE_WEAPON_POTENCY[value.base];
        if (potencyRuneValue > 0) {
          weapon.update({ "system.runes.potency": potencyRuneValue });
          HeroLabImporter.log(this.hlodebug, `Adding Potency Rune ${potencyRuneValue} to ${weapon.name}`);      
        }
        var strikingRuneValue = CONSTANTS.FUNDEMENTAL_RUNE_WEAPON_STRIKING[value.base];
        //Verify Strikeing
        if (strikingRuneValue > 0) {
          weapon.update({ "system.runes.striking": strikingRuneValue });
          HeroLabImporter.log(this.hlodebug, `Adding Strinking Rune ${strikingRuneValue} to ${weapon.name}`);
        }
        //Verify Property
        if (!potencyRuneValue && !strikingRuneValue) {
          var propertyRune = await this.findItem("pf2e.equipment-srd", value.name);
          if (propertyRune) {
            weapon.system.runes.property.push(propertyRune.system.slug);
            weapon.update({ "system.runes.property": weapon.system.runes.property });
            HeroLabImporter.log(this.hlodebug, `Adding Property Rune ${propertyRune.name} to ${weapon.name}`);

          }
        }
      }
    }
  }

  async updateItemQuantity(targetActor, addedItem, count) {
    //Update the quatity. Some items, like rope, are exported weirdly, so we exclude them.
    const excludedItems = new Map([
      ['Rope', 50],
    ]);

    if (excludedItems.get(addedItem.name)) {
      count = count / excludedItems.get(addedItem.name);
    }

    addedItem.update({ "system.quantity": count });
  }

  async updateActorSpells(targetActor, exportItems) {
    //Adds the spells
    const traditions = {}
    const innateTraditions = {}

    HeroLabImporter.log(this.hlodebug, "Importing Spells")

    //Get spells by traditions
    for (let [key, spell] of Object.entries(exportItems['spell'])) {
      let tradition = undefined
      //if((tradition = spell.Trait.split(',').find(value => /^trd/.test(value))?.substring(3))  && spell?.useInPlay) {
      if ((tradition = spell.Trait.split(',').find(value => /^trd/.test(value))?.substring(3))) {

        if (spell?.SpellHelper === "Innate") {
          if (tradition in innateTraditions) {
            innateTraditions[tradition].push(spell);
          }
          else {
            innateTraditions[tradition] = [];
            innateTraditions[tradition].push(spell);
          }
        }
        else {
          if (tradition in traditions) {
            traditions[tradition].push(spell);
          }
          else {
            traditions[tradition] = [];
            traditions[tradition].push(spell);
          }
        }
      }
      else this.spellsNotAdded.push(spell.name);
    }

    //Get defaults for Class
    let actorClass = CONSTANTS.CLASS_CASTER_TYPE[exportItems.class[0].name.toLowerCase()]

    await this.updateFocusSpells(targetActor, exportItems);
    await this.updateSpellcastingEntry(targetActor, traditions, actorClass);
    await this.updateInnateSpells(targetActor, innateTraditions, actorClass);
  }

  async updateInnateSpells(targetActor, traditions, actorClass) {
    var spellcastingEntry;
    //Loop through the traditions from export
    for (let [tradition, spells] of Object.entries(traditions)) {

      //See if they have a tradition that matches their class spellcasting abilities
      //See if they already have this tradition
      spellcastingEntry = this.existingSpellcastingEntry(targetActor.spellcasting.collections.entries(), actorClass.ability, 'innate', tradition);
      //They don't have one, so make it
      if (!spellcastingEntry) spellcastingEntry = await this.createSpellcastingEntry(targetActor, `Innate Spells`, tradition.toLowerCase(), 'innate', actorClass.ability);

      //Add the spells to the spellcasting entry
      for (let [key, spell] of Object.entries(spells)) {
        let spellItem = await this.findItem('pf2e.spells-srd', itemRename(spell.name))
        //Can't find spell, try without ()
        if (!spellItem) spellItem = await this.findItem("pf2e.spells-srd", itemRename(spell.name.replace(/\s*\(.*?\)\s*/g, '')));

        let foundSpell = spellcastingEntry.getName(spellItem.name)
        if (foundSpell?.system.location.heightenedLevel != spell.spLevelNet && !foundSpell?.system.traits.value.includes('cantrip')) {
          let newSpell = await spellcastingEntry.addSpell(spellItem, { groupId: spell.spLevelNet });
          this.debugMatch.Spells.push({ import: spell, export: newSpell });
          newSpell.update({ 'system.location.uses.max': spell?.trkMaximum, 'system.location.uses.min': spell?.trkMaximum }, { render: false });
        }
      }

      spellcastingEntry.entry.update({ 'system.showSlotlessLevels.value': false });
    }
  }

  async updateSpellcastingEntry(targetActor, traditions, actorClass) {
    var spellcastingEntry;

    //Get any dedications that grant spellcasting
    let dedicationClass = new Map();
    let dedicationFeats = targetActor.items.filter(i => /Dedication/.test(i.name) && i.type == 'feat');

    for (let [k, v] of Object.entries(dedicationFeats)) {
      let testClass = CONSTANTS.CLASS_CASTER_TYPE[v.name.split(' ')[0].toLowerCase()];
      if (testClass) dedicationClass.set(v.name.split(' ')[0], testClass);
    }

    //Loop through the traditions from export
    for (let [tradition, spells] of Object.entries(traditions)) {
      let dedication = Array.from(dedicationClass).find(i => i[1].tradition.includes(tradition.toLowerCase()))

      //See if they have a tradition that matches their class spellcasting abilities
      if (actorClass.tradition.includes(tradition.toLowerCase())) {
        //See if they already have this tradition
        spellcastingEntry = this.existingSpellcastingEntry(targetActor.spellcasting.collections.entries(), actorClass.ability, actorClass.type, tradition);
        //They don't have one, so make it
        if (!spellcastingEntry) spellcastingEntry = await this.createSpellcastingEntry(targetActor, `${targetActor.class.name} Spells`, tradition.toLowerCase(), actorClass.type, actorClass.ability);
      }
      else if (dedication) {
        //See if they already have this tradition
        spellcastingEntry = this.existingSpellcastingEntry(targetActor.spellcasting.collections.entries(), dedication[1].ability, dedication[1].type, tradition);
        //They don't have one, so make it
        if (!spellcastingEntry) spellcastingEntry = await this.createSpellcastingEntry(targetActor, `${dedication[0]} Spells`, tradition.toLowerCase(), dedication[1].type, dedication[1].ability);
      }

      //Add the spells to the spellcasting entry
      for (let [key, spell] of Object.entries(spells)) {
        let spellItem = await this.findItem('pf2e.spells-srd', itemRename(spell.name))
        //Can't find spell, try without ()
        if (!spellItem) spellItem = await this.findItem("pf2e.spells-srd", itemRename(spell.name.replace(/\s*\(.*?\)\s*/g, '')));

        let foundSpell = spellcastingEntry.getName(spellItem.name)
        if (spellcastingEntry.entry.system.prepared.value === "prepared") {
          if (!foundSpell) spellcastingEntry.addSpell(spellItem);
        }
        else if (foundSpell?.system.location.heightenedLevel != spell.spLevelNet && !foundSpell?.system.traits.value.includes('cantrip')) {
          spellcastingEntry.addSpell(spellItem, { groupId: spell.spLevelNet });
        }
        this.debugMatch.Spells.push({ import: spell, export: spellItem });
      }
    }
  }

  async updateFocusSpells(targetActor, exportItems) {
    //Add focus spells
    for (let [key, spell] of Object.entries(exportItems['focus'])) {
      let tradition = spell.Trait.split(',').find(value => /^trd/.test(value)).substring(3)
      let cl = spell.Trait.split(',').find(value => /^cl/.test(value)).substring(2)
      let focusClass = CONSTANTS.CLASS_CASTER_TYPE[cl.toLowerCase()]

      //Check for existing entry
      let spellcastingEntry = this.existingSpellcastingEntry(targetActor.spellcasting.collections.entries(), focusClass.ability, 'focus', tradition);
      if (!spellcastingEntry) spellcastingEntry = await this.createSpellcastingEntry(targetActor, `${cl} Focus Spells`, tradition.toLowerCase(), 'focus', focusClass.ability);

      let spellItem = await this.findItem('pf2e.spells-srd', itemRename(spell.name))

      //If they don't have it, give it to them
      if (!spellcastingEntry.getName(spellItem.name)) {
        spellcastingEntry.addSpell(spellItem, spell.spLevelNet);
        this.debugMatch.Spells.push({ import: spell, export: spellItem });
      }
    }
  }

  existingSpellcastingEntry(spellcastingEntries, ability, prepared, tradition) {
    //Check for existing spellcasting entry
    for (let [key, value] of spellcastingEntries) {
      let spEntry = value.entry.system;
      if (spEntry?.ability.value == ability.substring(0, 3) && spEntry?.prepared.value == prepared && spEntry?.tradition.value == tradition.toLowerCase())
        return value;
    }
    return undefined;
  }

  async createSpellcastingEntry(targetActor, name, tradition, prepared, ability) {
    //Create a spellcasting entry

    const createData = {
      type: 'spellcastingEntry',
      name: name,
      system: {
        prepared: {
          value: prepared
        },
        ability: {
          value: ability.substring(0, 3)
        },
        tradition: {
          value: tradition
        }
      }
    }

    const [spellcastingEntry] = await targetActor.createEmbeddedDocuments('Item', [createData], { render: false });

    return spellcastingEntry.spells;
  }

  static log(force, ...args) {
    const shouldLog = force || hlodebug

    if (shouldLog) {
      console.log("%cHeroLab Importer | %c" + args, color1, color4)
    }
  }
}
