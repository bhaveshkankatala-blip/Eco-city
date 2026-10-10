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
    idle: ['Quiet day on the island', 'Chai, cricket and gossip on Neem Street', 'Council meets, nothing decided', 'Monsoon forecast: normal, for now', 'The island waits to see what you build'],
  },
  tutorial: [
    { title: 'Pick a building', text: 'Everything you can build is in the bar at the bottom. Start with Food Crops: 1,000 people are hungry.', target: 'build-bar' },
    { title: 'Place it on the land', text: 'Click any green block inside the yellow border. A see-through preview shows where it will go.', target: 'map' },
    { title: 'Factories on resources', text: 'Coal, gold and uranium sit in scattered blocks. A factory can cover 1–3 of them: pick the size, and the shape with "Next path".', target: 'build-bar' },
    { title: 'Read your city, then finish', text: 'The numbers on the left are this year\'s reality. When you are ready, press Finish. After this, the game will not tell you what to build.', target: 'finish' },
  ],
  sdg: {
    intro: 'Your score is the average of these 11 UN Sustainable Development Goals, measured every year your city lives. A city that feeds, houses, heals and employs its people for centuries, without poisoning its air or using up its land, scores highest.',
    goals: [
      { n: 2, name: 'Zero Hunger', what: 'Everyone has enough to eat, every year.', inGame: 'Food grown (plus stored) compared with what your people eat.' },
      { n: 3, name: 'Good Health', what: 'People live long, healthy lives.', inGame: 'Hospital care, clean air and how many people die each year.' },
      { n: 4, name: 'Quality Education', what: 'Every child gets a good education.', inGame: 'How many of your people your schools can teach.' },
      { n: 6, name: 'Clean Water', what: 'Safe water for everyone.', inGame: 'Water supply compared with use, and a reservoir that never runs dry.' },
      { n: 7, name: 'Clean Energy', what: 'Affordable, clean power for all.', inGame: 'Enough power for the city, and how much of it is clean.' },
      { n: 8, name: 'Decent Work', what: 'Jobs for everyone who can work.', inGame: 'Share of workers with jobs, and a city that is not in debt.' },
      { n: 9, name: 'Industry & Infrastructure', what: 'Roads and industry that connect people.', inGame: 'Share of your buildings next to a road.' },
      { n: 11, name: 'Sustainable Cities', what: 'Safe homes and green, lasting cities.', inGame: 'Homes for everyone, green space, and how long your city lasts.' },
      { n: 12, name: 'Responsible Consumption', what: 'Using resources without using them up.', inGame: 'Income that does not depend on mines that run out, and food stored for bad years.' },
      { n: 13, name: 'Climate Action', what: 'Cutting pollution and its effects.', inGame: 'Low pollution, year after year.' },
      { n: 15, name: 'Life on Land', what: 'Protecting forests and green land.', inGame: 'Green cover: empty land, parks and forests.' },
    ],
  },
  whatHappened: {
    headlineGrowth: 'Your city grew',
    headlineDecline: 'Your city shrank',
    headlineStable: 'Your city held steady',
    causes: {
      hunger: 'not enough food', thirst: 'not enough water', poverty: 'poverty: no work', slums: 'overcrowded slums', pollution: 'polluted air', old: 'old age and natural causes',
    },
  },
  endings: {
    thriving: { title: 'Still standing', text: 'Five centuries later, your island is still home to thousands. The planners of today did right by the people of tomorrow.' },
    dead: { title: 'A dead planet', text: 'The streets are silent. What you built could not carry the people who came after you.' },
    deathReasons: {
      population: 'Nobody was left.',
      famine: 'Food or water ran short for eight years in a row.',
      pollution: 'The air stayed poisonous for ten years in a row.',
    },
  },
};
if (window.ECO_CONTENT_OVERRIDE) {
  const o = window.ECO_CONTENT_OVERRIDE;
  for (const k of Object.keys(o)) if (k !== 'events') window.ECO_CONTENT[k] = Object.assign(Array.isArray(o[k]) ? [] : {}, window.ECO_CONTENT[k], o[k]);
  if (o.sdg && Array.isArray(o.sdg)) window.ECO_CONTENT.sdg = { intro: o.sdg.intro || window.ECO_CONTENT.sdg.intro, goals: o.sdg };
}
