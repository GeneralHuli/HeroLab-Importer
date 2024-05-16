cHeroLabHooks.on('ready', async function() {
    if (game.system.id!="pf2e") {
      console.log("%cHeroLab Importer | %cWrong game system. %cNot enabling.",color1,color5,color4);
    } else {
      console.log("%cHeroLab Importer | %cinitializing",color1,color4);
        game.settings.register('HeroLab-importer', 'userToken', {
            name : "User Token (optional)",
            hint : "Please enter your personal user token. A user token allows external tools (like this one) to access the HeroLab server and perform export operations.",
            scope : 'world',
            config : true,
            type : String,
            default : '',
            onChange: value => (userToken=game.settings.get('HeroLab-importer', 'userToken'))
        });
        game.settings.register('HeroLab-importer', 'debugEnabled', {
            name : "Enable debug mode",
            hint : "Debug output will be written to the js console.",
            scope : 'world',
            config : true,
            type: Boolean,
            default: false,
            onChange: value => (HeroLabdebug=game.settings.get('HeroLab-importer', 'debugEnabled'))
        });
    }
    HeroLab = new HeroLabImporter(HeroLabdebug);
    HeroLabdebug=game.settings.get('HeroLab-importer', 'debugEnabled');
    userToken=game.settings.get('HeroLab-importer', 'userToken')
  });