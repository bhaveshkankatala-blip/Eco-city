/* Default in-game text. ChatGPT's ecocity-content.json replaces any of these keys when it arrives
   (the build script inlines it as window.ECO_CONTENT_OVERRIDE). Event text lives in engine.js EVENTS. */
window.ECO_CONTENT = {
  startScreen: {
    tagline: 'Build to last',
    pitch: 'A village of 1,000 people on a floating island. Feed them, power them, give them work and homes, then watch your city live for 500 years. Plan only for today and it starves tomorrow.',
  },
  news: {
    hungry: ['Ration queues stretch round the old market', 'Dal is getting thinner in every kitchen', 'Grain prices double overnight', 'Children skip school to queue for rice', 'Island Times: "Is anyone counting the mouths?"'],
    thirsty: ['Taps run dry by noon in the east wards', 'Tankers mobbed at every street corner', 'Wells dug deeper, still nothing', 'Water fights break out at the public pump', 'Bathing reduced to once a week, say residents'],
    no_power: ['Power cuts every evening, generators roar', 'Factories idle as the lights go out', 'Students study under street lamps', 'Inverter shops sold out across the island', 'Fans stop, tempers rise'],
    jobless: ['Hundreds queue for ten factory jobs', 'Young graduates sell tea on the main road', 'Families borrow to get by', 'Unemployment office open, nobody behind the desk', 'Idle hands at every chai stall'],
    slums: ['Three families share one room in the old quarter', 'Tin shacks spread along the river bank', 'Monsoon leaks in every crowded lane', 'Landlords double the rent again', 'Fever spreads fastest where houses are packed'],
    polluted: ['Grey haze hides the hills for a week', 'Coughing season comes early this year', 'Washing on the line turns grey by evening', 'Doctors report more asthma in children', 'Sunsets are orange, and nobody is smiling'],
    drought: ['Fields crack as the rains stay away', 'River so low you can walk across', 'Farmers watch the sky, then the empty well', 'Weak monsoon, worried villages', 'Old-timers blame the missing forests'],
    rich: ['City treasury overflowing, say officials', 'New sweet shops open on every corner', 'Property prices climb', 'Council debates what to do with the surplus', 'Island Times: money is not the problem, for once'],
    broke: ['City cannot pay its bills', 'Repairs postponed, again', 'Salaries late for city workers', 'Council borrows to keep the lights on', 'Potholes everywhere, budget nowhere'],
    healthy_city: ['Clinic waiting rooms nearly empty', 'Morning walkers fill the parks', 'Life expectancy up, say doctors', 'Cleanest air in years', 'Kids play cricket till sunset'],
    many_children: ['Schools packed, three shifts a day', 'Cradle makers cannot keep up', 'Every street has a cricket match', 'Toy shops booming', 'A generation is growing up fast'],
    many_elderly: ['Grandparents outnumber grandchildren in the old wards', 'Pension queues grow longer', 'Clinics full of familiar faces', 'Fewer hands, more wisdom', 'Who will work the fields tomorrow?'],
    coal_running_out: ['Miners dig deeper for thinner seams', 'Coal trucks half empty this week', 'Engineers warn the seam is nearly done', 'Coal town wonders what comes next', 'The black hills are almost hollow'],
    green_city: ['Birds back on the banyan trees', 'Forests cool the summer afternoons', 'Rain arrives right on time', 'Tourists come to see the green island', 'Peacocks spotted near the school'],
    dirty_river: ['Factory waste turns the river brown', 'Fishermen pull up empty nets', 'Children told not to swim downstream of the factories', 'Brown foam spotted below the coal yard', 'Villagers downstream complain of foul water'],
    austerity: ['Council cuts hospital hours to pay the bank', 'Teachers unpaid for the third month', 'Bank sends its men to the town hall', 'Island Times: how long can the city keep borrowing?', 'Street lights switched off to save money'],
    untrained: ['Factory hires from outside: no trained workers here', 'Power plant runs short of engineers', 'Hospital cannot find nurses', 'Young people want jobs, nobody taught them how', 'Skilled workers retire, nobody to replace them'],
    idle: ['Quiet day on the island', 'Chai, cricket and gossip on Neem Street', 'Council meets, nothing decided', 'Monsoon forecast: normal, for now', 'The island waits to see what you build'],
  },
  tutorial: [
    { title: 'Pick a building', text: 'Everything you can build is in the bar at the bottom, grouped by what it does. Hover a card to read it in full. Start with Food Crops: farms are free in Level 1, everything else comes out of your ₹50 L budget.', target: 'build-bar' },
    { title: 'Place it on the land', text: 'Click any green block inside the yellow border. A see-through preview shows where it will go.', target: 'map' },
    { title: 'Choose its workers', text: 'Each farm, plant or factory asks how many workers to give it. Fewer workers means less of everything it makes: half the crew, half the output. Move workers any time with "Assign workers" under Jobs, or Inspect a building. New workers from a growing city fill empty places on their own.', target: 'stats' },
    { title: 'Plants and mines on resources', text: 'Pick a coal plant or a mine and its blocks are marked in red. Choose how many blocks it covers, and the shape with "Next path". Every card says how many workers it needs.', target: 'build-bar' },
    { title: 'Three things that end a city', text: 'Debt: money below zero costs 4% interest a year; 5 years in a row and services are cut, 20 years and the city is bankrupt. Power: less than half of what the city needs for 15 years ends it, and power cuts kill. Schools: without them the next generation cannot run plants, factories or hospitals (output falls to 70%).', target: 'stats' },
    { title: 'Upgrade what you have', text: 'From Level 2 you can upgrade: open "Inspect & demolish", choose Inspect and click a building. Plants, mines and factories grow onto the next resource block (each step costs more and needs more workers, water and energy). Homes can add rooftop solar and rainwater tanks.', target: 'build-bar' },
    { title: 'Read your city, then finish', text: 'The numbers on the left are this year\'s reality. When you are ready, press Finish. After this, the game will not tell you what to build.', target: 'finish' },
  ],
  sdg: {
    intro: 'Your city is scored on these 13 UN Sustainable Development Goals in three rounds: after Level 1 (20%), after Level 2 (40%) and after Level 3 (40%). Each round also loses points for deaths a better city would have prevented and for losing money. A city that feeds, houses, heals and employs its people for centuries, without poisoning its air or using up its land, scores highest.',
    goals: [
      { n: 1, name: 'No Poverty', what: 'Nobody lives in poverty.', inGame: 'Jobs for everyone who can work, a city that earns more than it spends, and no debt.' },
      { n: 2, name: 'Zero Hunger', what: 'Everyone has enough to eat, every year.', inGame: 'Food grown (plus stored) compared with what your people eat.' },
      { n: 3, name: 'Good Health', what: 'People live long, healthy lives.', inGame: 'Hospital care, clean air and how many people die each year.' },
      { n: 4, name: 'Quality Education', what: 'Every child gets a good education.', inGame: 'How many of your people your schools can teach. Trained workers also make plants, factories and hospitals work better.' },
      { n: 6, name: 'Clean Water', what: 'Safe water for everyone.', inGame: 'Water supply compared with use, a reservoir that never runs dry, and a river free of factory waste.' },
      { n: 7, name: 'Clean Energy', what: 'Affordable, clean power for all.', inGame: 'Enough power for the city, and how much of it is clean.' },
      { n: 8, name: 'Decent Work', what: 'Jobs for everyone who can work.', inGame: 'Share of workers with jobs, and a city that is not in debt.' },
      { n: 9, name: 'Industry & Infrastructure', what: 'Roads and industry that connect people.', inGame: 'Share of your buildings next to a road.' },
      { n: 11, name: 'Sustainable Cities', what: 'Safe homes and green, lasting cities.', inGame: 'Homes for everyone (half the score), roads that reach every building (a quarter), and parks and forests near people: one green block for every 500 people (a quarter).' },
      { n: 12, name: 'Responsible Consumption', what: 'Using resources without using them up.', inGame: 'Income that does not depend on mines that run out, and food stored for bad years.' },
      { n: 13, name: 'Climate Action', what: 'Cutting pollution and its effects.', inGame: 'Low pollution, year after year.' },
      { n: 15, name: 'Life on Land', what: 'Protecting forests and green land.', inGame: 'Natural land: forests you plant, parks (half) or land you simply leave wild, all count. A little real forest for wildlife, and how little ground you dig up.' },
      { n: 17, name: 'Partnerships', what: 'Working together with others to reach the goals.', inGame: 'How much your neighbours trust you. Help them when they are in trouble and they will help you in yours.' },
    ],
  },
  whatHappened: {
    headlineGrowth: 'Your city grew',
    headlineDecline: 'Your city shrank',
    headlineStable: 'Your city held steady',
    causes: {
      crisis: 'crises (heat, disease, storms)', hunger: 'not enough food', thirst: 'not enough water', poverty: 'poverty: no work', slums: 'overcrowded slums', pollution: 'polluted air', dark: 'power cuts (no pumps, light or cold storage)', old: 'old age and natural causes',
    },
  },
  endings: {
    thriving: { title: 'Still standing', text: 'Five centuries later, your island is still home to thousands. The planners of today did right by the people of tomorrow.' },
    survived: { title: 'Still here, barely', text: 'The island made it to the end, but it only survived. It did not thrive.' },
    dead: { title: 'A dead planet', text: 'The streets are silent. What you built could not carry the people who came after you.' },
    deathReasons: {
      population: 'Nobody was left.',
      famine: 'Food or water ran short for eight years in a row.',
      pollution: 'The air stayed poisonous for ten years in a row.',
      bankrupt: 'The city was in debt for twenty years in a row and went bankrupt.',
      blackout: 'The city had less than half the power it needs for fifteen years in a row.',
    },
  },
};
if (window.ECO_CONTENT_OVERRIDE) {
  const o = window.ECO_CONTENT_OVERRIDE;
  for (const k of Object.keys(o)) if (k !== 'events') window.ECO_CONTENT[k] = Object.assign(Array.isArray(o[k]) ? [] : {}, window.ECO_CONTENT[k], o[k]);
  if (o.sdg && Array.isArray(o.sdg)) window.ECO_CONTENT.sdg = { intro: o.sdg.intro || window.ECO_CONTENT.sdg.intro, goals: o.sdg };
}
