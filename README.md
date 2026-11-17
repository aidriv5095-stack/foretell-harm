# Foretell Harm — Oracle Automation

Author: Mazi'keen
GitHub: https://github.com/aidriv5095-stack/foretell-harm

Automates the Oracle feat **Foretell Harm** (Player Core 2, Feat 1, cursebound / divine / oracle) in Foundry VTT with the PF2e system.

**The feat, RAW:** free action, once per round. Requirement: your previous action was casting a non-cantrip spell that dealt damage. At the beginning of your target's next turn, it takes damage equal to **twice the triggering spell's rank, of a type matching the spell**. Then it is temporarily immune for 24 hours.

A composite spell deals one 2x-rank hit of one type you choose, not one hit per type. For example, a rank 5 bludgeoning-and-cold spell deals 10 bludgeoning *or* 10 cold, not both.

The PF2e system ships this feat with no rule elements (`rules: []`), so dragging it to your sheet only posts to chat. This module tracks the delayed damage and the immunity.

## Install

1. Copy this whole `foretell-harm` folder into your Foundry User Data folder, under `Data/modules/` — so you have `Data/modules/foretell-harm/module.json`.
   - Or zip the *contents* of this folder (with `module.json` at the root of the zip) and install via Install Module > Manifest URL / upload, if your host supports it.
2. Restart Foundry if it was running.
3. In your world (PF2e system), go to Manage Modules and enable **Foretell Harm — Oracle Automation**.
4. Done. There is **no arming step**. The GM's client installs the turn-start hook automatically on `ready`. The GM must be logged in for the damage to fire, same as with the macro version.

Compatibility in `module.json` is set to Foundry minimum 12, verified 13. If you are on a different generation, change `verified` to the build you actually tested on.

## Use

1. Cast a damaging non-cantrip spell as normal.
2. With the spell's target(s) still targeted, run the hotbar macro.
3. Enter the spell's rank and the ONE damage type matching the spell.
4. At the start of each marked target's next turn, the hook applies 2x rank damage of that type, posts to chat, and puts a 24-hour **Foretell Harm Immunity** effect on the target.

### Hotbar macro

Create a Script macro in Foundry (paste the file contents in, or copy the one-liner below):

**`macros/foretell-harm-raw-macro.js`:**
```js
ForetellHarm.trigger();
```

## Rules notes

- **Which target?** The feat never explicitly says which creature is "the target". The natural reading is the creature(s) damaged by the triggering spell, and Pathfinder Society clarified it applies to all targets of an area spell. This module marks every token you have targeted.
- **Once per round** is enforced per combat round, on the Oracle actor.
- **Immunity:** targets with a **Foretell Harm Immunity** effect are skipped, with a warning.
- **Outside combat** it refuses, because "the beginning of the target's next turn" needs a combat to mean anything.

## Caveats — read before you trust it in a real session

- Damage is applied as a **flat number** via `actor.applyDamage()`. Weaknesses and resistances are **not** processed automatically. If the target has a weakness to the type, the GM adds it by hand. If weaknesses matter a lot at your table, roll the damage to chat and use the damage card's apply buttons instead — those do handle weaknesses/resistances.
- The module trusts you to only trigger it after a qualifying spell. It cannot verify that your previous action was a non-cantrip damaging spell.
- This was verified against the PF2e system's own code paths (the `pf2e.startTurn` hook and `applyDamage`), but it has **not been run live in your Foundry**. Test it in a safe scene first: cast a low-rank spell, mark a test target, advance to its turn, and check the damage and the immunity effect land. If it throws an error, send the exact console message and it can be fixed.
- For Mazi'keen: Foretell Harm is the Tempest mystery's starting feat, so she would have had it from level 1.

## Files

```
foretell-harm/
  module.json
  README.md
  LICENSE
  scripts/
    foretell-harm.js          — the module itself, RAW only
  macros/
    foretell-harm-raw-macro.js
```
