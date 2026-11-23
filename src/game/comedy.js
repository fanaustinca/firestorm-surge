// Comedy content: death-screen roasts, bot trash talk, MVP card titles. Pure data + pickers.
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');

// ───── death-screen roasts (shown under "KILLED BY …") ─────
const QUIPS = {
  snowball_launcher: ['You got snowballed. In a war. Embarrassing.', 'Frosty the Snowman sends his regards.', 'Brain freeze, but permanent.'],
  paintball_gun: ['You\'re a modern art piece now.', 'Bob Ross called it a happy little accident.', 'Honestly, the colours suit you.'],
  water_gun: ['Hydrated to death. Drink responsibly.', 'Your 8 glasses a day, delivered all at once.', 'Soaked. Defeated. Damp.'],
  tennis_launcher: ['15–love. Actually, 15–dead.', 'Served. Aced. Deleted.', 'You got out-tennised by a person with a gun.'],
  spear: ['THIS. IS. SPAWN SCREEN!', 'Skewered like a kebab.', 'Ancient technology still works, apparently.'],
  slippers: ['Mom\'s slipper finds all.', 'The chancla has spoken.', 'EMOTIONAL DAMAGE (and physical).'],
  chainsaw: ['Brrrrrrrrrr. You\'re in pieces now.', 'The lumberjack mistook you for a tree.', 'Timber!'],
  rubber_chicken: ['Death by poultry. Your ancestors weep.', 'You were BONKED by a squeaky chicken.', 'Bawk bawk, you\'re dead.'],
  banana_peel: ['Slipped on a banana. Like a cartoon.', 'Mario Kart flashbacks.', 'The oldest trick in the book. And you fell for it.'],
  turkey_launcher: ['You got stuffed.', 'Killed by dinner. Gobble gobble.', 'Thanksgiving came early. For them.'],
  present_launcher: ['SURPRISE! It was an explosion.', 'You\'re on the naughty list now.', 'Unwrapped. Literally.'],
  confetti_cannon: ['You were celebrated to death. 🎉', 'Party\'s over. For you specifically.', 'Happy New Year! You won\'t see it.'],
  rocket_launcher: ['Rocket science was not on your side.', 'You achieved orbit briefly.'],
  frag: ['You were holding the pin, weren\'t you.', 'Grenade: 1, You: 0.'],
  land_mine: ['Watch your step. Too late.', 'Floor was lava. Well, mines.'],
  fists: ['Punched out. With actual fists. Wow.', 'Knuckle sandwich, served fresh.'],
  bat: ['HOME RUN!', 'Out of the park.'],
  sledgehammer: ['Hammer time. Stop.', 'Flattened like a pancake.'],
  heavy_sniper: ['Didn\'t even see it coming. Literally.', 'Headshot from another postcode.'],
  flamethrower: ['Well done. Like, medium-well.', 'Someone call the fire department. Too late.'],
  mortar: ['Death from above. Look up next time.'],
};
const GENERIC_QUIPS = ['Skill issue (theirs was better).', 'Respawn and pretend that didn\'t happen.', 'The floor tasted nice, didn\'t it?', 'Bold strategy. Didn\'t work.', 'Have you tried not dying?', 'You were the main character for 0 seconds.', 'Git gud (lovingly).', 'Your controller must be unplugged.'];
const SELF_QUIPS = ['You played yourself. Literally.', 'Friendly fire, but you\'re the friend.', 'Achievement unlocked: own goal.', 'Bold of you to be your own worst enemy.'];
const QUICK_QUIPS = ['Speedrun: spawn → death. New PB!', 'Blink and you\'ll miss it. You did.', 'That life lasted shorter than a TikTok.'];
export function deathQuip({ weapon, self, quick } = {}) {
  if (self) return pick(SELF_QUIPS);
  if (quick && Math.random() < 0.6) return pick(QUICK_QUIPS);
  const b = weapon && weapon.endsWith('_ultra') ? weapon.slice(0, -6) : weapon;
  return QUIPS[b] && Math.random() < 0.85 ? pick(QUIPS[b]) : pick(GENERIC_QUIPS);
}

// ───── bot trash talk (chat feed) ─────
const LINES = {
  kill: ['gg ez', 'sit down {victim}', 'too easy', 'was that your best, {victim}?', 'uninstall pls', 'I\'m literally eating cereal rn', 'my grandma aims better {victim}', 'get rekt', 'L', 'that one was for my cat', 'clip it', '{victim} lag?', 'ok I\'m kind of cracked', 'refund your gaming chair {victim}', 'ratio', 'mom come see this'],
  death: ['LAG', 'my mouse died', 'I was AFK', 'how', 'bro what', 'that\'s so unfair', 'hacks??', 'my cat walked on the keyboard', 'I wasn\'t even trying', 'reported', 'nooooooo', 'I want a rematch', 'okay that was kinda funny', 'my monitor was off', 'tell my wife I loved her', 'ok {killer} chill', '{killer} touch grass', 'I sneezed', 'wasn\'t looking', 'I was buying a snack', 'whyyyy'],
  silly: { // victim lines by weapon
    tennis_launcher: ['a TENNIS BALL? really?', '15-love me one more time I dare you'],
    rubber_chicken: ['did I just get killed by a CHICKEN', 'BAWK BAWK??', 'that chicken has a family'],
    banana_peel: ['WHO LEFT A BANANA THERE', 'I slipped I SLIPPED', 'mario kart ahh death'],
    chainsaw: ['bro brought a CHAINSAW', 'this isn\'t a horror movie {killer}', 'brrrrr'],
    slippers: ['not the chancla 😭', 'I got flashbacks', 'MOM?'],
    water_gun: ['I\'m soaked', 'my socks are wet now', 'thanks for the shower {killer}'],
    snowball_launcher: ['ice cold', 'snowball fight escalated'],
    paintball_gun: ['I\'m blue da ba dee', 'my outfit is ruined'],
    turkey_launcher: ['killed by a TURKEY', 'gobble gobble I\'m dead'],
    present_launcher: ['worst. gift. ever.', 'I wanted socks'],
    confetti_cannon: ['why is there confetti everywhere', 'happy birthday to me I guess'],
    spear: ['spear?? what year is it', 'this is sparta?'],
  },
  yeet: ['WHEEEEEEEE', 'I CAN FLY', 'see you in orbit', 'YEEEEEET', 'I can see my house from here'],
  slip: ['WHO PUT THAT THERE', 'my ankle 😭', 'banana??', 'nice banana... NOT', 'this map has bananas now??', 'I\'m fine. I\'m FINE.'],
  revenge: ['REVENGE IS SWEET {victim}', 'remember me {victim}?', 'payback 😎'],
  dominated: ['{killer} please leave me alone', '{killer} why do you hate me', 'I\'m switching teams'],
  streak: ['someone stop {name}', '{name} is cheating fr', 'TEAM FOCUS {name}', '{name} chill bro'],
  start: ['glhf', 'I\'m gonna carry', 'who\'s ready to lose', 'let\'s gooo', 'gl everyone (you\'ll need it)', 'warming up my trigger finger', 'brb getting snacks'],
  afk: ['{name} you alive?', 'is {name} AFK lol', '{name} went to make a sandwich', 'ok {name} is literally a statue'],
};
export function botLine(kind, v = {}) {
  let pool = LINES[kind];
  if (kind === 'death' && v.weapon) { const b = v.weapon.replace(/_ultra$/, ''); if (LINES.silly[b] && Math.random() < 0.7) pool = LINES.silly[b]; }
  return pool ? fill(pick(pool), v) : '';
}

// ───── MVP card subtitles ─────
const MVP_TITLES = ['Carried harder than a backpack', 'Main character energy', 'Built different', 'The bots are scared of this one', 'Respectfully: menace', 'Absolutely cooked everyone', 'Has a gaming chair with RGB'];
export const mvpTitle = () => pick(MVP_TITLES);
