export const SYMBOLS = ['sun', 'wave', 'eye', 'reed', 'moon'];

export const RELICS = {
  r1: { name: 'Jade Moth', chapter: 1, outfit: 'wraith', blurb: 'A moth carved from river jade. Its wings are worn smooth by a thumb that kept it close.' },
  r2: { name: 'Resonance Bell', chapter: 2, outfit: 'singer', blurb: 'A bell with no clapper. Held to the ear, it returns the sound of a room you have never entered.' },
  r3: { name: 'Tide Compass', chapter: 3, outfit: 'tide', blurb: 'Its needle points not north, but downward. The drowned city still keeps its bearings.' },
  r4: { name: 'Black Codex', chapter: 4, outfit: 'archivist', blurb: 'Pages of hammered lead. Every line has been scraped away and written over, again and again.' },
  r5: { name: 'Sun Key', chapter: 5, outfit: 'sunforged', blurb: 'Warm to the touch. It was never made to open a door. It was made to keep one closed.' },
};

export const OUTFITS = {
  default: { name: 'Field Jacket', desc: 'Canvas, dust, and stubbornness.', colors: { jacket: '#b7a06c', shirt: '#315c54', pants: '#2b3d3a', accent: '#d7b36a', skin: '#c99472', hair: '#2b1d17' } },
  wraith: { name: 'Jungle Wraith', desc: 'Woven from expedition canvas and vine fibre.', colors: { jacket: '#4d7458', shirt: '#1e3e35', pants: '#24352b', accent: '#9fce87', skin: '#c99472', hair: '#211711' } },
  singer: { name: 'Echo Singer', desc: 'Ceremonial silk that still carries a note.', colors: { jacket: '#7b5a8f', shirt: '#372b50', pants: '#2a2338', accent: '#c7a5e8', skin: '#c99472', hair: '#2b1d17' } },
  tide: { name: 'Tidewalker', desc: 'Oilskin and pearl buttons. It never quite dries.', colors: { jacket: '#3c6e82', shirt: '#173d4a', pants: '#1d2f38', accent: '#8ed5df', skin: '#c99472', hair: '#211711' } },
  archivist: { name: 'Keeper of Stacks', desc: 'Ink-stained gloves and a lamp-black coat.', colors: { jacket: '#44374d', shirt: '#261f33', pants: '#211c28', accent: '#cbb27a', skin: '#c99472', hair: '#2b1d17' } },
  sunforged: { name: 'Sunforged', desc: 'Gold thread over old scars.', colors: { jacket: '#b06c3a', shirt: '#63301f', pants: '#3d241b', accent: '#ffd483', skin: '#c99472', hair: '#211711' } },
  sovereign: { name: 'The Ninth Echo', desc: 'The colour of a memory that refuses to fade.', colors: { jacket: '#d9cfa8', shirt: '#304c45', pants: '#20322e', accent: '#fff2bd', skin: '#c99472', hair: '#e8e2cf' } },
};

export const DOCS = {
  d_camp: {
    chapter: 1, type: 'Field note', title: 'A Note Left in the Camp',
    body: `11 June — The crew has abandoned the lower cut. They say the stones hum at night. I say the stones are the only honest things here.\n\nEvelyn, if you find this: I taught you that absence is evidence. So look at what is missing from this place. Not the artefacts. The records. Someone has been editing the expedition.\n\nThe symbol below was carved inside the well, beneath eight feet of silt. It is not a warning. It is a signature.\n\n— A.V.`,
    pair: 'd_ledger',
  },
  d_ledger: {
    chapter: 1, type: 'Ledger', title: 'Expedition Roster, Page 9',
    body: `PERSONNEL — VALE EXPEDITION, SECOND SEASON\n\nProf. A. Vale — director\nE. Cross — cartography (arrived 14 June)\nDr. S. Rook — artefacts (arrived 2 June)\nM. Okafor — photographer\n...\n\nPage 10 has been cut out. The stub shows the impression of a second list, written with a harder hand. At the bottom, pressed into the paper: eight names, all crossed through. The ink is recent. The page is older than the expedition.`,
    pair: 'd_camp',
  },
  d_seal: {
    chapter: 1, type: 'Inscription', title: 'The Archivist\'s Seal',
    body: `The door is not locked. It is remembering.\n\nA voice comes out of the stone when you touch it: "THE TRUTH LIES BENEATH THE SILENCE."\n\nBelow the words, in Vale's own shorthand: "Third seal. Rook has the other two. Do not let him hear you coming."\n\nThe final line is not in his hand. It is not in any living hand.`,
  },
  d_survey: {
    chapter: 2, type: 'Survey', title: 'Acoustic Survey, Chamber II',
    body: `The chamber is not a room. It is a throat.\n\nEvery surface has been cut to a different angle. A word spoken at the west door arrives at the east wall four seconds late, and in a lower voice. The mirrors are not decoration. They are the instrument's stops.\n\nThe Listeners did not worship sound. They used it to find what was buried. And, I think, to hide what was not.\n\n— A.V.`,
    pair: 'd_hymn',
  },
  d_hymn: {
    chapter: 2, type: 'Liturgy', title: 'Hymn of the Listeners',
    body: `Three seals answer the door.\n\nFirst: the eye that opens in the day.\nSecond: the wave that carries the drowned.\nThird: the reed that bends but does not break.\n\nSet the sun where the sun was. Set the water where the water went. Set the reed where the wind is silent.\n\nThe door will believe you.`,
    pair: 'd_survey',
  },
  d_letter: {
    chapter: 2, type: 'Letter', title: 'A Letter from S. Rook',
    body: `Adrian,\n\nYou keep calling it theft. I keep calling it rescue. The Choir has held these objects for nine hundred years and told no one. If that is preservation, I would rather be a thief.\n\nYou asked me once what the Order is for. The answer is simple: we decide what the world is allowed to remember. You have been useful because you are sentimental. Sentimental men write things down.\n\nEvelyn is asking questions. Keep her out of the lower levels, or I will do it for you.\n\n— Silas`,
    pair: 'd_engine',
  },
  d_tide: {
    chapter: 3, type: 'Log', title: 'Tidekeeper\'s Log',
    body: `Third sluice. Water high: the city breathes. Water low: the city remembers.\n\nWe kept the valves because the machine below is not a pump. It is a mouth. When the basin fills, it swallows the echo. When it empties, the echo comes back.\n\nThe last keeper wrote: "Do not stand in the basin when the water falls. It will take you for a memory."\n\nBeneath, in another hand: "He was not exaggerating."`,
    pair: 'd_census',
  },
  d_census: {
    chapter: 3, type: 'Census', title: 'Census of the Drowned',
    body: `Nine hundred names. Nine hundred families. All of them struck from the histories of six kingdoms on the same day.\n\nThe margins are crowded with notes in Vale's hand: "same as the Athens shipment", "same as the Rook acquisition", "same as the fire at the Institute".\n\nOne line is underlined twice: "They are not stealing artefacts. They are stealing the proof that anyone was ever here."`,
    pair: 'd_tide',
  },
  d_engine: {
    chapter: 3, type: 'Treatise', title: 'The Dirge Engine',
    body: `The Aurel did not vanish. They chose silence.\n\nFaced with a weapon that could unmake memory itself, they built a city around it and taught the machine to eat its own history. Every record, every song, every name — fed into the Engine so that no one could ever use the weapon again.\n\nThe Order calls itself the Choir of Ash. It is not a cult. It is a maintenance crew. They have kept the silence for nine hundred years.\n\nAnd now someone has begun to feed it again.`,
    pair: 'd_letter',
  },
  d_cipher: {
    chapter: 4, type: 'Cipher', title: 'Cipher of the Ninth',
    body: `The floor is a sentence. Step only where the sentence makes sense.\n\nI. The first mark is the eye, set into the western shelf.\nII. The wave follows, where the water stain reaches the floor.\nIII. The reed stands at the centre, beneath the broken lamp.\nIV. The sun closes the line, at the eastern stair.\n\nDo not step twice. The library is listening.`,
    pair: 'd_marginalia',
  },
  d_marginalia: {
    chapter: 4, type: 'Marginalia', title: 'Notes in a Borrowed Book',
    body: `Rook was here before me. He has taken the index volumes, which is like stealing a man's name and leaving his coat.\n\nEvelyn — I am writing this because I may not get to say it. The Order is not wrong about everything. There is a weapon beneath the Sanctuary. It was used once. The silence that followed was not peace. It was a decision made by frightened people who called it mercy.\n\nI have made the same decision. I am sorry.`,
    pair: 'd_cipher',
  },
  d_confession: {
    chapter: 4, type: 'Confession', title: 'Vale\'s Confession',
    body: `I joined the Choir in 1921. I told myself I was protecting the world from a second Unmaking. For fifteen years I signed the orders that erased villages, expeditions, families.\n\nWhen I found you, Evelyn, I stopped. I told the Choir you were nobody. I hid your file inside the Engine's own index, where no one would look, because no one looks at the thing they are afraid of.\n\nYou are not nobody. You are the last name the Engine refused to eat.\n\nIf you are reading this, I am either dead or finally brave. I hope the second.`,
    pair: 'd_ledger2',
  },
  d_ledger2: {
    chapter: 5, type: 'Ledger', title: 'The Hollow Sun Ledger',
    body: `ACQUISITIONS — FINAL QUARTER\n\nOne jade moth, Peru. One bell, Anatolia. One compass, the drowned city. One codex, the library. One key, the Sanctuary.\n\nFiled under: PERSONAL — A. VALE.\n\nIn the column marked "disposition", every item has the same word: RETURNED.\n\nAt the bottom, a newer entry, unsigned: "The Ninth Echo has entered the temple. The Curator has gone to meet her. Close the doors."`,
    pair: 'd_confession',
  },
  d_final: {
    chapter: 5, type: 'Last entry', title: 'Adrian\'s Last Entry',
    body: `The truth lies beneath the silence.\n\nI wrote that to you because I could not write the rest. Beneath the silence is not a secret. It is a door. Behind the door is the Engine, and behind the Engine is a choice that the Aurel made for all of us.\n\nI have spent my life tending their silence. I am tired, Evelyn. I would like to be remembered by one person who knew me before I became careful.\n\nWhen you reach the chamber, do not listen to Rook. Listen to the room. It has been waiting for a voice like yours for nine hundred years.\n\n— Your Adrian`,
    pair: 'd_final',
  },
};

export const DEDUCTIONS = [
  { id: 'ded_roster', pair: ['d_camp', 'd_ledger'], title: 'The roster was rewritten', text: 'Vale\'s expedition and the Order share the same missing names. Someone has been editing who was there.' },
  { id: 'ded_instrument', pair: ['d_survey', 'd_hymn'], title: 'The temple is an instrument', text: 'Sound, light, and water are all parts of one mechanism. The three seals are tuning it.' },
  { id: 'ded_witnesses', pair: ['d_letter', 'd_engine'], title: 'The Order erases witnesses', text: 'Rook calls it preservation, but his acquisitions and the erased census share the same dates. The "rescue" is the crime.' },
  { id: 'ded_engine', pair: ['d_tide', 'd_census'], title: 'The Engine feeds on memory', text: 'The drowned city was not lost. It was sacrificed to hide the weapon. The Order has been repeating that sacrifice.' },
  { id: 'ded_vale', pair: ['d_cipher', 'd_marginalia'], title: 'Vale was inside the Choir', text: 'Adrian knew the Order from the inside and stayed to protect someone. The library is his confession.' },
  { id: 'ded_ninth', pair: ['d_confession', 'd_ledger2'], title: 'Evelyn is the Ninth Echo', text: 'The last name the Engine could not erase. Adrian hid her file inside the machine itself.' },
];

export const STORY_OPENING = [
  { who: 'Narrator', text: 'The telegram arrived three weeks after the expedition stopped writing. It contained no words. Only a symbol: a sun with an eye at its centre.' },
  { who: 'Evelyn', text: 'Adrian Vale taught me that every ruin is a sentence. This one is a threat.' },
  { who: 'Adrian', text: 'If you are reading this, Evelyn, I am already behind the door. The truth lies beneath the silence. Do not trust the men who sent me here.' },
  { who: 'Narrator', text: 'Evelyn Cross followed the symbol into the jungle. The camp was empty. The dig was open. And someone had been through the professor\'s notes with a knife.' },
];

export const CHAPTERS = [
  {
    id: 1, roman: 'I', title: 'The Forgotten Expedition', location: 'Vale Expedition Camp · The Cloud Forest',
    blurb: 'An abandoned dig. A mentor\'s last note. The first stone that remembers.',
    art: 'jungle', unlockStars: 0,
    levels: ['1-1', '1-2', '1-3'],
    intro: [
      { who: 'Evelyn', text: 'The camp is exactly as he left it. That is the first thing that frightens me.' },
      { who: 'Narrator', text: 'Tents half-struck. A kettle cold on the fire. And beneath the noise of the jungle, a silence that has edges.' },
      { who: 'Evelyn', text: 'All right, Adrian. Let us see what you wanted me to find.' },
    ],
    outro: [
      { who: 'Narrator', text: 'The archive door closes behind Evelyn. On the other side, a bronze moth rests in a bed of dust — and a fresh bootprint crosses the floor toward the temple.' },
      { who: 'Evelyn', text: 'Rook. He is always one room ahead of me.' },
    ],
  },
  {
    id: 2, roman: 'II', title: 'Temple of Echoes', location: 'The Resonant Caves · Beneath the Cloud Forest',
    blurb: 'A temple cut as an instrument. Light is a key; sound is a warning.',
    art: 'echoes', unlockStars: 9,
    levels: ['2-1', '2-2'],
    intro: [
      { who: 'Narrator', text: 'The stair descends farther than the hill above it should allow.' },
      { who: 'Evelyn', text: 'Every step comes back wrong. A half-second late. A note lower.' },
      { who: 'Adrian', text: 'The room is not empty, Evelyn. It is listening.' },
    ],
    outro: [
      { who: 'Evelyn', text: 'The bell has no clapper, but it rings when I hold it. It rings the way a name sounds when someone is trying not to say it.' },
      { who: 'Narrator', text: 'Far below, water begins to move. Something has been waiting for the bell to answer.' },
    ],
  },
  {
    id: 3, roman: 'III', title: 'The Sunken City', location: 'The Drowned Quarter · Vaelor',
    blurb: 'Flooded corridors, ancient machinery, and a census of the erased.',
    art: 'sunken', unlockStars: 15,
    levels: ['3-1', '3-2'],
    intro: [
      { who: 'Narrator', text: 'The tunnel opens onto a city folded into a cavern: streets below water, roofs above it, and lamps still burning in rooms no one has entered for centuries.' },
      { who: 'Evelyn', text: 'The water is not still. It is waiting for a tide that stopped coming.' },
      { who: 'Narrator', text: 'A valve wheel turns easily. Somewhere below, a gate inhales.' },
    ],
    outro: [
      { who: 'Evelyn', text: 'Nine hundred names. Every one erased on the same day. This was not a disappearance. It was an operation.' },
      { who: 'Narrator', text: 'The tide compass in her hand warms. Its needle points down, toward a library that should not exist.' },
    ],
  },
  {
    id: 4, roman: 'IV', title: 'The Library of Shadows', location: 'The Black Archive · Below Vaelor',
    blurb: 'Forbidden knowledge, borrowed books, and the truth about the man who taught her.',
    art: 'library', unlockStars: 21,
    levels: ['4-1', '4-2'],
    intro: [
      { who: 'Evelyn', text: 'A library with no books. Only shelves, and the dust where books were taken.' },
      { who: 'Rook', text: 'You are late, Evelyn. Adrian always said you were the clever one. He never said you were quick.' },
      { who: 'Evelyn', text: 'Silas. You look well for a man who has been dead in three different countries.' },
    ],
    outro: [
      { who: 'Evelyn', text: 'Adrian was one of them. He signed the erasures. He hid me from the Engine. He has been lying to me for fifteen years.' },
      { who: 'Narrator', text: 'The confession burns in her pocket. Ahead, a staircase of black glass descends toward a light that has no source.' },
    ],
  },
  {
    id: 5, roman: 'V', title: 'The Lost Sanctuary', location: 'The Ninth Chamber · The Silence',
    blurb: 'The final door. The Curator. A choice that was made nine hundred years ago.',
    art: 'sanctuary', unlockStars: 27,
    levels: ['5-1', '5-2'],
    intro: [
      { who: 'Rook', text: 'Welcome to the engine room. Nine hundred years of careful silence, and the only person who can end it is a cartographer with her father\'s stubbornness.' },
      { who: 'Evelyn', text: 'Not my father.' },
      { who: 'Rook', text: 'Ask him. He is through there. He has been waiting for you longer than you know.' },
    ],
    outro: [
      { who: 'Narrator', text: 'The Engine is not a machine. It is a room full of names, held in light. Nine hundred years of people the world was made to forget.' },
      { who: 'Adrian', text: 'You came. I was afraid you would. And more afraid you would not.' },
      { who: 'Evelyn', text: 'You erased them. All of them.' },
      { who: 'Adrian', text: 'I kept the door shut. There is a difference. It is not a good difference, but it is real.' },
      { who: 'Narrator', text: 'Behind them, Rook raises the Sun Key. The Engine opens like an eye. And every name in the room turns toward Evelyn — the last name it refused to eat.' },
    ],
  },
];

export const SECRET_CHAPTER = {
  id: 6, roman: 'IX', title: 'The Ninth Echo', location: 'The Hidden Ossuary · Unknown',
  blurb: 'Only those who carried all five relics can hear this room.',
  art: 'secret', unlockStars: 0, levels: ['S-1'],
  intro: [
    { who: 'Narrator', text: 'The five relics arrange themselves on the floor. The room is not a room. It is a memory of one.' },
    { who: 'Adrian', text: 'The Ninth Echo was never a person. It was the question the Engine could not answer. You have brought it back with you.' },
  ],
  outro: [
    { who: 'Narrator', text: 'The ossuary fills with a sound like a held breath finally released. Somewhere, a name is written again.' },
    { who: 'Evelyn', text: 'Not all of them. Not yet. But a beginning is a kind of map.' },
  ],
};

export const ENDING = [
  { who: 'Narrator', text: 'Rook fires the Sun Key into the heart of the Engine. The chamber opens. And Evelyn hears every erased name at once.' },
  { who: 'Adrian', text: 'You can close it. You are the only one who can. But the Engine will take something from you first.' },
  { who: 'Evelyn', text: 'It already took my childhood. It does not get the rest.' },
  { who: 'Narrator', text: 'She does not close the door. She turns the key the other way. The Engine exhales — and nine hundred years of silence become a memory the world can hold.' },
  { who: 'Rook', text: 'You have no idea what you have done.' },
  { who: 'Evelyn', text: 'No. But I know where the truth was.' },
  { who: 'Narrator', text: 'Outside, the temple is quiet. Not the silence of a kept secret. The silence after a story is finally told. Evelyn Cross walks into the morning with her mentor\'s notebook, a jade moth in her pocket, and one name she did not have to steal back: her own.' },
];
