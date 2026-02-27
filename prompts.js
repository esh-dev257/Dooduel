const EASY = [
  'a cat wearing sunglasses',
  'a dog on a skateboard',
  'a penguin with an umbrella',
  'a robot waving hello',
  'a dragon breathing fire',
  'a monkey eating a banana',
  'an elephant in a bathtub',
  'a shark with a hat',
  'a frog on a lily pad',
  'a bear with a fishing rod',
  'a snowman with a scarf',
  'a ghost saying boo',
  'a cowboy on a horse',
  'an alien in a spaceship',
  'a superhero flying',
  'a pirate with a parrot',
  'a flamingo on one leg',
  'a unicorn with a rainbow',
  'a wizard with a wand',
  'a ninja throwing a star',
  'a house with a garden',
  'a fish in a bowl',
  'a bird in a nest',
  'a pizza with toppings',
  'a car driving fast'
];

const MEDIUM = [
  'a cat wearing sunglasses at the beach',
  'a dog riding a skateboard down a hill',
  'a penguin delivering pizza in the rain',
  'a robot cooking dinner in a tiny kitchen',
  'a dragon blowing out birthday candles',
  'an elephant balancing on a circus ball',
  'a shark wearing a top hat at a tea party',
  'a giraffe trying to ride a bicycle',
  'a snowman sunbathing on a tropical island',
  'a ghost trying to use a computer',
  'a fish walking a dog on a leash',
  'a dinosaur working in an office cubicle',
  'a vampire afraid of a tiny spider',
  'a zombie trying on clothes at a mall',
  'a house made entirely of candy',
  'a hot air balloon made of pizza',
  'a knight fighting a giant rubber duck',
  'a squirrel robbing a nut store',
  'a detective cat solving a mystery',
  'a lamp that is afraid of the dark',
  'a couch potato that is literally a potato on a couch',
  'the sun and moon playing chess together',
  'a rainbow being used as a waterslide',
  'a witch flying on a vacuum cleaner',
  'a spy disguised as a potted plant'
];

const HARD = [
  'a treehouse city connected by rope bridges at sunset',
  'an underwater restaurant for sea creatures with a whale as the chef',
  'a castle built on top of a sleeping giant in the clouds',
  'a rollercoaster going through an erupting volcano over a lake of lava',
  'a time machine built out of a shopping cart in a supermarket parking lot',
  'breakfast food having a board meeting at a conference table with coffee',
  'a phone charging itself by running on a treadmill in a tiny gym',
  'a volcano erupting spaghetti and meatballs while people eat below',
  'a tornado made entirely of rubber ducks destroying a toy store',
  'a mad scientist turning a frog into a prince in a messy laboratory',
  'a time traveler accidentally arriving at a dinosaur birthday party',
  'a fairy godmother fixing her broken magic wand with duct tape and glitter',
  'a gladiator battling a giant teddy bear in a colosseum full of toys',
  'a samurai slicing watermelons at a fruit stand while customers cheer',
  'a pirate fighting a ninja on top of a moving train over a canyon',
  'a chef juggling flaming pineapples while riding a unicycle on a tightrope',
  'an octopus playing drums with all eight arms at a rock concert',
  'a goldfish escaping from its bowl on a motorcycle through a city',
  'a hamster piloting a giant mech suit fighting a kaiju in Tokyo',
  'a teacher launching into space on a rocket chair from a classroom',
  'a spaceship shaped like a giant donut landing on a planet made of candy',
  'a submarine exploring a bathtub ocean with rubber duck islands',
  'a forest where the trees are giant lollipops and the river is chocolate',
  'a thunderstorm inside a snow globe held by a surprised giant',
  'a leprechaun guarding a pot of noodles instead of gold at the end of a rainbow'
];

const ROUNDS = {
  1: { prompts: EASY, label: 'Easy', duration: 90 },
  2: { prompts: MEDIUM, label: 'Medium', duration: 60 },
  3: { prompts: HARD, label: 'Hard', duration: 45 }
};

const lastUsed = new Set();

function getPromptForRound(round) {
  const config = ROUNDS[round] || ROUNDS[3];
  const pool = config.prompts;

  if (lastUsed.size >= pool.length - 3) {
    lastUsed.clear();
  }

  let prompt;
  do {
    prompt = pool[Math.floor(Math.random() * pool.length)];
  } while (lastUsed.has(prompt));

  lastUsed.add(prompt);
  return {
    prompt,
    difficulty: config.label,
    duration: config.duration
  };
}

// Keep backward compat
function getRandomPrompt() {
  return getPromptForRound(1).prompt;
}

module.exports = { getRandomPrompt, getPromptForRound, ROUNDS };
