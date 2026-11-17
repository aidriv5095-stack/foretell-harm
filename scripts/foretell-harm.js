// ============================================================================
// Foretell Harm — Oracle feat (Player Core 2, remaster)
// Foundry VTT + PF2e system — MODULE version
// PUBLIC VERSION — RAW ONLY.
// What the feat does (pf2e-to-md vault, Player Core 2):
//   Feat 1, cursebound / divine / oracle. FREE action, once per round.
//   Requirement: your previous action was casting a non-cantrip spell that
//   dealt damage. At the beginning of your target's next turn, it takes
//   damage equal to TWICE the triggering spell's rank, of ONE type matching
//   the spell. The target is then temporarily immune for 24 hours.
//   A composite spell deals ONE 2x-rank hit of ONE chosen type.
//
// How this module differs from the standalone macro:
//   - No arming step. The GM's client installs the pf2e.startTurn hook
//     automatically on `ready`. The GM just needs to be logged in, as
//     before — the hook that applies damage runs on the GM's client.
//   - The Oracle uses a one-line hotbar macro (see README.md):
//       ForetellHarm.trigger()
//     That opens the rank + damage-type prompt and marks the target(s).
//
// Storage / permissions:
//   Players can't write flags/effects onto enemy NPCs they don't own, so
//   the pending mark is stored on the ORACLE's own actor (which the player
//   owns) and the GM-side hook does the damage and the immunity effect.
//
// CAVEATS (read these)
//   - Damage is applied as a FLAT NUMBER via actor.applyDamage().
//     Weaknesses/resistances are NOT processed automatically. If the
//     target has a weakness to the damage type, the GM adds it manually.
//     For full weakness/resistance handling, roll the damage to chat and
//     use the damage card's apply buttons instead.
//   - The module trusts you to only trigger it after a qualifying spell
//     (a non-cantrip damaging spell as your previous action). It can't
//     verify that for you.
//   - The feat text never says explicitly WHICH creature is "the target"
//     — the natural reading is the creature(s) damaged by the triggering
//     spell, and Pathfinder Society clarified it applies to ALL targets
//     of an area spell. This marks every token you have targeted.
//   - Once per round is enforced per combat round. Outside combat it
//     refuses, because "the beginning of the target's next turn" needs
//     a combat to mean anything.
// ============================================================================

const MODULE_ID = "foretell-harm";
const FLAG_SCOPE = "world";
const PENDING_KEY = "foretell-harm-pending"; // on the ORACLE actor
const USED_KEY = "foretell-harm-used"; // on the ORACLE actor: {combat, round}

const DAMAGE_TYPES = [
  "acid", "cold", "electricity", "fire", "sonic", "force", "mental",
  "poison", "vitality", "void", "spirit",
  "bludgeoning", "piercing", "slashing",
];

// ---------- Turn-start hook (GM only, installed once on ready) ----------
function installHook() {
  if (globalThis.__foretellHarmHookInstalled) return;
  globalThis.__foretellHarmHookInstalled = true;

  Hooks.on("pf2e.startTurn", async (combatant) => {
    if (!game.user.isGM) return;
    const actor = combatant?.actor;
    if (!actor) return;
    const tokenId = combatant.token?.id ?? combatant.tokenId;
    const combatId = game.combat?.id;

    for (const oracle of game.actors) {
      const allPending = oracle.getFlag(FLAG_SCOPE, PENDING_KEY) ?? [];
      const due = allPending.filter((p) => p.tokenId === tokenId && p.combat === combatId);
      if (!due.length) continue;
      const remaining = allPending.filter((p) => !(p.tokenId === tokenId && p.combat === combatId));
      await oracle.unsetFlag(FLAG_SCOPE, PENDING_KEY);
      if (remaining.length) await oracle.setFlag(FLAG_SCOPE, PENDING_KEY, remaining);

      const token = combatant.token?.object ?? canvas.tokens.get(tokenId);
      for (const mark of due) {
        await actor.applyDamage({ damage: mark.damage, token });
        await ChatMessage.create({
          content: `<p><strong>Foretell Harm:</strong> ${actor.name} takes <strong>${mark.damage} ${mark.type}</strong> damage as a misfortune finds them.</p>`,
          speaker: { alias: "Foretell Harm" },
        });
      }
      // 24-hour immunity marker on the target
      await actor.createEmbeddedDocuments("Item", [
        {
          name: "Foretell Harm Immunity",
          type: "effect",
          img: "icons/sundries/books/book-red-exclamation.webp",
          system: {
            description: { value: "<p>Temporarily immune to Foretell Harm.</p>" },
            duration: { value: 24, unit: "hours" },
            traits: { value: [] },
            level: { value: 1 },
          },
        },
      ]);
    }
  });
}

// ---------- Prompt: rank + ONE damage type ----------
async function promptForSpell() {
  const rankOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    .map((r) => `<option value="${r}">${r}</option>`)
    .join("");
  const typeOptions = DAMAGE_TYPES.map((t) => `<option value="${t}">${t}</option>`).join("");
  const content = `<form>
    <div class="form-group"><label>Triggering spell rank</label><select name="rank">${rankOptions}</select></div>
    <div class="form-group"><label>Damage type (matching the spell)</label><select name="type">${typeOptions}</select></div>
    <p class="hint">Use this right after casting a damaging non-cantrip spell. Damage is twice the spell's rank, of ONE type.</p>
  </form>`;

  return new Promise((resolve) => {
    if (foundry?.applications?.api?.DialogV2) {
      // Foundry v13+
      foundry.applications.api.DialogV2.wait({
        window: { title: "Foretell Harm" },
        content,
        buttons: [
          {
            action: "ok",
            label: "Mark Target",
            default: true,
            callback: (_event, _button, dialog) => resolve({
              rank: Number(dialog.element.querySelector('[name="rank"]').value),
              type: dialog.element.querySelector('[name="type"]').value,
            }),
          },
          { action: "cancel", label: "Cancel", callback: () => resolve(null) },
        ],
      }).catch(() => resolve(null));
    } else {
      // Foundry v12 and earlier
      new Dialog({
        title: "Foretell Harm",
        content,
        buttons: {
          ok: {
            label: "Mark Target",
            callback: (html) => resolve({
              rank: Number(html.find('[name="rank"]').val()),
              type: html.find('[name="type"]').val(),
            }),
          },
          cancel: { label: "Cancel", callback: () => resolve(null) },
        },
        default: "ok",
      }).render(true);
    }
  });
}

// ---------- Trigger: mark target(s) ----------
async function trigger() {
  const targets = [...game.user.targets];
  if (!targets.length) {
    return ui.notifications.warn("Target the spell's target(s) first, then run Foretell Harm.");
  }
  const oracle = game.user.character ?? canvas.tokens.controlled[0]?.actor;
  if (!oracle) return ui.notifications.warn("Select your Oracle token first.");
  if (!game.combat) {
    return ui.notifications.warn(
      "Foretell Harm needs an active combat — the damage lands at the start of the target's next turn."
    );
  }

  const used = oracle.getFlag(FLAG_SCOPE, USED_KEY);
  if (used?.combat === game.combat.id && used?.round === game.combat.round) {
    return ui.notifications.warn("Foretell Harm has already been used this round (once per round).");
  }

  const answer = await promptForSpell();
  if (!answer?.rank || !answer?.type) return;
  const damage = answer.rank * 2;

  const marks = [];
  for (const target of targets) {
    const tActor = target.actor;
    if (!tActor) continue;
    if (tActor.itemTypes.effect.some((e) => e.name === "Foretell Harm Immunity")) {
      ui.notifications.warn(`${tActor.name} is immune to Foretell Harm for 24 hours.`);
      continue;
    }
    marks.push({
      tokenId: target.id,
      actorId: tActor.id,
      combat: game.combat.id,
      rank: answer.rank,
      type: answer.type,
      damage,
    });
  }
  if (!marks.length) return;

  const existing = oracle.getFlag(FLAG_SCOPE, PENDING_KEY) ?? [];
  await oracle.setFlag(FLAG_SCOPE, PENDING_KEY, [...existing, ...marks]);
  await oracle.setFlag(FLAG_SCOPE, USED_KEY, { combat: game.combat.id, round: game.combat.round });
  await ChatMessage.create({
    content: `<p><strong>${oracle.name}</strong> uses <strong>Foretell Harm</strong> on ${marks
      .map((m) => game.actors.get(m.actorId)?.name ?? "target")
      .join(", ")} — ${damage} ${answer.type} damage at the start of their next turn.</p>`,
    speaker: { alias: oracle.name },
  });
}

// ---------- Module lifecycle ----------
Hooks.once("init", () => {
  console.log("Foretell Harm | init");
});

Hooks.once("ready", () => {
  installHook();
  globalThis.ForetellHarm = {
    trigger: () => trigger(),
  };
  if (game.user.isGM) {
    console.log("Foretell Harm | ready — turn hook installed, no arming needed.");
  }
});
