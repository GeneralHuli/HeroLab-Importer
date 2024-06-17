# Hero Lab Online PF2e Importer

This FoundryVTT module imports Pathfinder 2E characters from Hero Lab Online.

Currently, it has basic funtionality with improvements planned along the way.
Built with heavy inspiration from zarmstrong's [Herolab Online PF2e Import Tool](https://github.com/zarmstrong/hlo-importer), as it looks like it's been abandoned.

# Features

## Class, Ancestry, Heritage, Background

Will work for all official content in the Pathfinder 2e compediums. Options that are prompted in FoundryVTT must be manually selected at time of import.

## Attributes

Imports attributes as "Manual Entry" only. Hoping that Lone Wolf is able to expand their export to include boosts.

## Equipment

Imports equipment correctly into containers, with everything unequiped. Uses a best match to the Pathfinder 2e compendiums. Has minor support for Legacy items, if you have the PF2e Legacy Content module installed. It is currently all-or-nothing, so recommended for new imports only! Probably will not work well with custom items.

## Spells

Imports spells into spellcasting entries. Uses a best match to the Pathfinder 2e compendiums. Has minor support for Legacy items, if you have the PF2e Legacy Content module installed. Will detect if you already have the spell, and only import new spells. Does NOT remove spells if you no longer have them. Works with Dedication Feats for additional spellcasting entries as well as focus spells, but if your additional spells use the same tradition that your base class *can* use, it will prefer your base class.

## Skills

The only thing that seems to work perfectly and as expected right now. Lore skills included.


# Issues/Future Plans

- If an added item would prompt for a selection, it currently cannot choose this for you. I would like to work on automagically choosing options. Limitations on the information given from Hero Lab Online may make this difficult.
- Attributes can only be "Manual Entry". Hero Lab Online does not, as of yet, provide information on boosts.
- Character descriptors (Hair/Eyes etc.) are not exported, so I can't import them.
- Equipment in the export are not listed as equipted or now, so I can't equipt them for you.
- Trying to compare equipment that you already have vs. what is imported is a nightmare. Maybe in the future I can tackle this, but there are just too many variables.
- Spells imported do not contain information on which spellcasting list they come from, so I can't know for sure where they should go. Worst case right now is you will have to move them accordingly, after importing.
- Feats are the same as the spells. I can only guess on the feat slot by the traits and the level of the feat.
- Hero Lab Online does not export recipes. Hopefully this will change in the future.
- Companions/Familiars. This shouldn't be too bad, but I'll need time to think it through.

## Addendum

I am not a Javascript developer. There WILL be bugs/issues I haven't seen before. Please use at your own risk, but PLEASE USE IT and [report](https://github.com/GeneralHuli/HeroLab-Importer/issues) anything you find.

I made this because I wanted an importer for Hero Lab Online. I hope you find it usefull too.