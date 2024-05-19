const hloiVer = "0.1.1"

let hlodebug = true;
const color1='color: #7bf542';  //bright green
const color2='color: #d8eb34'; //yellow green
const color3='color: #ffffff'; //white
const color4='color: #cccccc'; //gray
const color5='color: #ff0000'; //red
var HeroLab,userToken;
var HeroLabButton=true;


var characterExport;

console.log('HeroLab-Importer | Hello World!');

Hooks.on('ready', async function() {
  if (game.system.id!="pf2e") {
    console.log("%cHeroLab Importer | %cWrong game system. %cNot enabling.",color1,color5,color4);
  } else {
    console.log("%cHeroLab Importer | %cinitializing",color1,color4);
      game.settings.register('herolab-importer', 'userToken', {
          name : "User Token (optional)",
          hint : "Please enter your personal user token. A user token allows external tools (like this one) to access the HeroLab server and perform export operations.",
          scope : 'world',
          config : true,
          type : String,
          default : '',
          onChange: value => (userToken=game.settings.get('herolab-importer', 'userToken'))
      });
      game.settings.register('herolab-importer', 'debugEnabled', {
          name : "Enable debug mode",
          hint : "Debug output will be written to the js console.",
          scope : 'world',
          config : true,
          type: Boolean,
          default: false,
          onChange: value => (hlodebug=game.settings.get('herolab-importer', 'debugEnabled'))
      });
  }
  HeroLab = new HeroLabImporter(hlodebug);
  hlodebug=game.settings.get('herolab-importer', 'debugEnabled');
  userToken=game.settings.get('herolab-importer', 'userToken')
});

Hooks.on('herovaultfoundryReady', (api) => {
  if (hlodebug)
    console.log("Disabling HeroLab button since herovault is loaded");
  HeroLabButton=false;
});

Hooks.on('renderActorSheet', function(obj, html){
  hlodebug = game.settings.get('herolab-importer', 'debugEnabled');
  if (game.system.id!="pf2e") {
    console.log("%cHeroLab Importer | %cWrong game system. %cNot adding HeroLab button to actor sheet.",color1,color5,color4);
  } else {
    // Only inject the link if the actor is of type "character" and the user has permission to update it
      const actor = obj.actor;
      if (hlodebug) {
        console.log("%cHeroLab Importer | %cPF2e System Version: herolab-importer actor type: " + actor.type,color1,color4);
        console.log("%cHeroLab Importer | %cCan user modify: " + actor.canUserModify(game.user, "update"),color1,color4);
      }

      if (!(actor.type === "character")){ return;}
      if (actor.canUserModify(game.user, "update")==false){ return;}
      
      if (HeroLabButton) {
        let element = html.find(".window-header .window-title");
        if (element.length != 1) {return;}
        
        let button = $(`<a class="popout" style><i class="fas fa-flask"></i>HeroLab</a>`);
        userToken = game.settings.get('herolab-importer', 'userToken');
        if (hlodebug) {
          console.log("%cHeroLab Importer | %cherolab-importer token: "+ userToken,color1,color4);
        }
        button.on('click', () => HeroLab.beginHeroLabImport(obj.object,userToken));
        element.after(button);
      }
    }
  }
);

export class HeroLabImporter {
  constructor(hlodebug) {
    this.color1='color: #7bf542';  //bright green
    this.color2='color: #d8eb34'; //yellow green
    this.color3='color: #ffffff'; //white
    this.color4='color: #cccccc'; //gray
    this.color5='color: #ff0000';
    this.hlodebug = hlodebug;
  }

  async beginHeroLabImport(targetActor,userToken) {
    characterExport = await this.getHeroLabExport(userToken);
    this.importActorGameValues(targetActor,characterExport);

    const updates = [{_id: targetActor.id, name: targetActor.name}];
    const updated = await Actor.updateDocuments(updates);
    
  }

  async getHeroLabExport(userToken) {
    //Fix Element Token Later
    const elementToken = '$allJSEm~@P2#'

    console.log("%cHeroLab Importer | %cGetting export from Hero Lab Online ",color1,color4);
    const accessToken = await this.getHeroLabAccessToken(userToken);

    const characterExport = await fetchJsonWithTimeout("https://api.herolab.online/v1/character/get", {
      method: "POST",
      body: JSON.stringify({
          accessToken : accessToken,
          elementToken : elementToken
      }),
      headers: {
          "Content-type": "application/json; charset=UTF-8"
      }
    })
    
    /*  .then((response) => {
        console.log("%cHeroLab Importer | %cherolab-importer characterJSON: "+ response,color1,color4);
        if (!response.ok) {
          throw new error
            ('HTTP error! Status: ${response.status}');
        }
      })
      .then((data) =>
        console.log("%cHeroLab Importer | %cherolab-importer data: "+ data,color1,color4))
      .catch((error) => 
        console.error("%cHeroLab Importer | %cUnable to import HeroLab JSON! Error: "+error,color1,color4));
      
    console.log("%cHeroLab Importer | %cCharacter JSON: "+ characterJSON,color1,color4);
    */
    console.log("%cHeroLab Importer | %cCharacter Export: "+ characterExport.export,color1,color4)
    console.log(characterExport.export)
    return characterExport.export
    
  }

  async getHeroLabAccessToken(userToken) {
    console.log("%cHeroLab Importer | %cGetting access token from Hero Lab Online ",color1,color4);
    const response = await fetchJsonWithTimeout("https://api.herolab.online/v1/access/acquire-access-token", {
      method: "POST",
      body: JSON.stringify({
        refreshToken: userToken,
        toolName: "Importer",
        lifespan: 0
      }),
      headers: {
        "Content-type": "application/json; charset=UTF-8"
      }
    });

    return response.accessToken
  }

  importActorGameValues(targetActor,characterExport) {
    if(!(targetActor.name === characterExport.actors['actor.1'].name)) {
      targetActor.name = characterExport.actors['actor.1'].name;
      console.log("%cHeroLab Importer | %cUpdateing Actor Name to "+ characterExport.actors["actor.1"].name,color1,color4);
    }
    window.testCharacter = characterExport;

    targetActor.update({
      "flags.exportSource.world": game.world.id,
      "flags.exportSource.system": game.system.id,
      "flags.exportSource.systemVersion": game.system.version,
      "flags.exportSource.coreVersion": game.version,
      "flags.herolabimporter.version.value": hloiVer,
    });
  }
}