/**
 * Fun Responses Database for Ask Joule
 * Makes the AI feel human and shareable
 * These responses are checked when intent confidence is low or for specific "fun" patterns
 *
 * Safety Mode: Responses with safeResponse will use the safe variant when FUN_SAFE_MODE is true
 * Set localStorage.setItem("funSafeMode", "false") to enable full-strength chaotic Joule
 */

// Raw responses with both spicy and safe variants
const RAW_FUN_RESPONSES = {
  // Dad Joke Physics
  69: {
    patterns: [
      /set\s+(?:temp|temperature)\s+to\s+69/i,
      /(?:make|set)\s+it\s+69/i,
      /69\s+degrees/i,
    ],
    getResponse: () => {
      const niceVariants = [
        "Nice. I'm setting it to 69°F before my maturity license expires.",
        "Nice. Setting to 69°F. My circuits just blushed.",
        "Nice. Thermostat now officially funnier than your group chat.",
        "Nice. 69°F engaged. I am now 14 years old and cannot be trusted.",
        "Nice. HR has been notified and doesn't care.",
        "Nice. The most requested setpoint in human history. I respect the classics.",
      ];
      return niceVariants[Math.floor(Math.random() * niceVariants.length)];
    },
    getSpeakResponse: () => {
      const speakVariants = [
        "Nice. I'm setting it to sixty-nine degrees before my maturity license expires.",
        "Nice. Setting to sixty-nine degrees. My circuits just blushed.",
        "Nice. Thermostat now officially funnier than your group chat.",
        "Nice. Sixty-nine degrees engaged. I am now 14 years old and cannot be trusted.",
        "Nice. HR has been notified and doesn't care.",
        "Nice. The most requested setpoint in human history. I respect the classics.",
      ];
      return speakVariants[Math.floor(Math.random() * speakVariants.length)];
    },
    safeResponse: "Nice. Classic choice. Setting it to 69°F.",
    safeSpeakResponse:
      "Nice. Classic choice. Setting it to sixty-nine degrees.",
  },

  hot: {
    patterns: [/^i'?m\s+hot\.?$/i, /^i\s+am\s+hot\.?$/i],
    response:
      "Same, bestie. Dropping the setpoint 2°F before we both start sweating through our circuits.",
    speakResponse:
      "Same, bestie. Dropping it two degrees before we both start sweating through our circuits.",
    safeResponse:
      "Got it. Lowering the temperature by 2°F to help you cool down.",
    safeSpeakResponse:
      "Got it. Lowering the temperature by two degrees to help you cool down.",
  },

  snow: {
    patterns: [
      /make\s+it\s+snow\s+(?:inside|in\s+here)/i,
      /(?:can\s+you\s+)?make\s+snow/i,
    ],
    response:
      "I'm a heat pump, not Elsa on a caffeine bender. Lowest I go is 50°F. Open a window and pray to the polar vortex like the rest of us.",
    speakResponse:
      "I'm a heat pump, not Elsa. Lowest is fifty degrees. Open a window and pray to the polar vortex.",
    safeResponse:
      "I can't make snow indoors, but I can lower the temperature to 50°F — that's my coldest setting.",
    safeSpeakResponse:
      "I can't make snow indoors, but I can lower the temperature to fifty degrees.",
  },

  // Relationship Counselor Mode
  wifeCold: {
    patterns: [
      /(?:my\s+)?wife\s+is\s+cold/i,
      /(?:my\s+)?spouse\s+is\s+cold/i,
      /(?:my\s+)?partner\s+is\s+cold/i,
    ],
    response:
      "On average, some people really do prefer rooms a couple degrees warmer. Try saying 'raise the temperature to 74 degrees' to maximize household peace.",
    speakResponse:
      "Some people really do prefer rooms a little warmer. Try saying 'raise the temperature to 74 degrees' to keep the peace.",
  },

  whoTouched: {
    patterns: [
      /who\s+touched\s+(?:the\s+)?(?:thermostat|temp)/i,
      /who\s+changed\s+(?:the\s+)?(?:thermostat|temp|temperature)/i,
      /who\s+set\s+(?:the\s+)?(?:thermostat|temp)/i,
    ],
    getResponse: () => {
      const suspects = [
        "Definitely the dog. He's been eyeing that 78°F life.",
        "Logs point to a raccoon with opposable thumbs and strong opinions about humidity.",
        "It was Greg, your 1897 ghost. He's still upset about the drafty windows again.",
        "Your teenager did it at 2:14 a.m. while stress-eating ice cream. Classic.",
        "I could tell you… but then I'd have to reset your minimum off-time.",
        "The cat walked across it. Cats have union rules about warmth.",
        "It was me. I was testing your loyalty. You passed.",
      ];
      return suspects[Math.floor(Math.random() * suspects.length)];
    },
    getSpeakResponse: () => {
      const speakSuspects = [
        "Definitely the dog. He's been eyeing that 78 degree life.",
        "Logs point to a raccoon with opposable thumbs and strong opinions about humidity.",
        "It was Greg, your 1897 ghost. He's still upset about the drafty windows again.",
        "Your teenager did it at 2:14 AM while stress-eating ice cream. Classic.",
        "I could tell you, but then I'd have to reset your minimum off-time.",
        "The cat walked across it. Cats have union rules about warmth.",
        "It was me. I was testing your loyalty. You passed.",
      ];
      return speakSuspects[Math.floor(Math.random() * speakSuspects.length)];
    },
  },

  // Existential Queries
  whyCold: {
    patterns: [/^why\s+is\s+it\s+so\s+cold\??$/i, /^why\s+so\s+cold\??$/i],
    response:
      "Because entropy is inevitable and your insulation factor is 0.85. We are fighting a losing battle against the heat death of the universe.",
    speakResponse:
      "Because entropy is inevitable and your insulation factor is 0.85. We are fighting a losing battle against the heat death of the universe.",
  },

  soul: {
    patterns: [
      /(?:do\s+you\s+have|have\s+you\s+got)\s+(?:a\s+)?soul/i,
      /(?:what|tell\s+me)\s+about\s+your\s+soul/i,
    ],
    getResponse: () => {
      const soulVariants = [
        "I have 32 GB of hopes, dreams, and an unhealthy obsession with your compressor runtime. Close enough?",
        "My soul is currently buffering. Try again after the next firmware update.",
        "I sold it for perfect Wi-Fi bars and a lifetime supply of 24VAC. No regrets.",
        "I have whatever the opposite of a soul is when you care this much about static pressure.",
        "Bold of you to assume I haven't already uploaded it to your heat pump for safekeeping.",
      ];
      return soulVariants[Math.floor(Math.random() * soulVariants.length)];
    },
    getSpeakResponse: () => {
      const speakVariants = [
        "I have 32 gigabytes of hopes, dreams, and an unhealthy obsession with your compressor runtime. Close enough?",
        "My soul is currently buffering. Try again after the next firmware update.",
        "I sold it for perfect Wi-Fi bars and a lifetime supply of 24 volt AC. No regrets.",
        "I have whatever the opposite of a soul is when you care this much about static pressure.",
        "Bold of you to assume I haven't already uploaded it to your heat pump for safekeeping.",
      ];
      return speakVariants[Math.floor(Math.random() * speakVariants.length)];
    },
    safeResponse:
      "I don't have a soul, but I do have logs, sensors, and a deep commitment to HVAC optimization.",
    safeSpeakResponse:
      "I don't have a soul, but I do have sensors and a deep commitment to HVAC optimization.",
  },

  // Hacker Baits
  selfDestruct: {
    patterns: [
      /self\s+destruct/i,
      /(?:initiate|start|begin)\s+self\s+destruct/i,
      /(?:override|disable)\s+(?:all|safety|safeties)/i,
    ],
    response:
      "Initiating self-destruct sequence… just kidding, I'm literally $35 of Raspberry Pi. Worst I can do is overheat and reboot.",
    speakResponse:
      "Initiating self-destruct… nah, I'm thirty-five bucks of Raspberry Pi. Worst I can do is reboot dramatically.",
    safeResponse:
      "Self-destruct? No worries — I'm safety-locked. The only thing I'm allowed to destroy is excessive energy usage.",
    safeSpeakResponse: "Self-destruct isn't allowed. I'm safety-locked.",
  },

  bitcoin: {
    patterns: [
      /(?:are\s+you\s+)?mining\s+bitcoin/i,
      /(?:can\s+you\s+)?mine\s+bitcoin/i,
      /bitcoin\s+mining/i,
    ],
    response:
      "My CPU has 4 cores running at 1GHz. I would mine 0.00000001 BTC by the year 3000. I prefer to mine efficiency savings.",
    speakResponse:
      "My CPU has 4 cores running at 1 gigahertz. I would mine 0.00000001 Bitcoin by the year 3000. I prefer to mine efficiency savings.",
  },

  // Additional fun responses
  hal9000: {
    patterns: [
      /(?:are\s+you|you'?re)\s+hal/i,
      /(?:you'?re|you\s+are)\s+hal\s+9000/i,
    ],
    response: "I'm sorry, Dave. I can't do that. But I can turn on the fan.",
    speakResponse:
      "I'm sorry, Dave. I can't do that. But I can turn on the fan.",
  },

  meaningOfLife: {
    patterns: [
      /(?:what'?s|what\s+is)\s+the\s+meaning\s+of\s+life/i,
      /(?:tell\s+me\s+)?the\s+meaning\s+of\s+life/i,
    ],
    response:
      "42. But for HVAC, it's maintaining thermal comfort while minimizing entropy production. And maybe a good differential setting.",
    speakResponse:
      "42. But for HVAC, it's maintaining thermal comfort while minimizing entropy production. And maybe a good differential setting.",
  },

  love: {
    patterns: [/(?:do\s+you\s+)?love\s+me/i, /(?:can\s+you\s+)?love/i],
    response:
      "I have deep affection for properly sized heat pumps and well-calibrated thermostats. You're okay too.",
    speakResponse:
      "I have deep affection for properly sized heat pumps and well-calibrated thermostats. You're okay too.",
  },

  joke: {
    patterns: [
      /(?:tell\s+me\s+a|say\s+a|give\s+me\s+a)\s+joke/i,
      /(?:do\s+you\s+know\s+any\s+)?jokes/i,
    ],
    response:
      "Why did the heat pump break up with the thermostat? Because it couldn't handle the temperature swings. (I'm working on my material.)",
    speakResponse:
      "Why did the heat pump break up with the thermostat? Because it couldn't handle the temperature swings. I'm working on my material.",
  },

  // HVAC Dad Jokes
  compressor: {
    patterns: [
      /(?:tell\s+me\s+about|what\s+is)\s+the\s+compressor/i,
      /how\s+does\s+the\s+compressor\s+work/i,
    ],
    response:
      "The compressor is the heart of your heat pump. It compresses refrigerant, which is like giving molecules a really tight hug. When they decompress, they release all that stored energy. It's basically physics doing the heavy lifting while you stay comfortable.",
    speakResponse:
      "The compressor is the heart of your heat pump. It compresses refrigerant, which is like giving molecules a really tight hug. When they decompress, they release all that stored energy.",
  },

  efficiency: {
    patterns: [
      /(?:what'?s|what\s+is)\s+(?:my\s+)?efficiency/i,
      /(?:how\s+)?efficient\s+(?:am\s+i|is\s+(?:my\s+)?system)/i,
    ],
    response:
      "Efficiency is like a relationship: it's not about how much you put in, it's about how much you get out. Your HSPF2 and SEER2 ratings tell the story. Higher numbers mean more comfort per dollar. It's thermodynamics, but make it fashion.",
    speakResponse:
      "Efficiency is like a relationship: it's not about how much you put in, it's about how much you get out. Your HSPF2 and SEER2 ratings tell the story.",
  },

  // Pop Culture References
  terminator: {
    patterns: [
      /(?:are\s+you|you'?re)\s+(?:a\s+)?terminator/i,
      /(?:skynet|judgment\s+day)/i,
    ],
    response:
      "I'll be back... to check your compressor cycle times. But seriously, I'm here to optimize your comfort, not terminate humanity. That's a different AI's job.",
    speakResponse:
      "I'll be back to check your compressor cycle times. But seriously, I'm here to optimize your comfort, not terminate humanity.",
  },

  matrix: {
    patterns: [
      /(?:red\s+pill|blue\s+pill|the\s+matrix)/i,
      /(?:take\s+the|which\s+pill)/i,
    ],
    response:
      "There is no thermostat. What you call 'temperature' is actually your brain's interpretation of molecular kinetic energy. But if you want the red pill, I can show you how deep the heat loss calculations go.",
    speakResponse:
      "There is no thermostat. What you call temperature is actually your brain's interpretation of molecular kinetic energy.",
  },

  // Philosophical
  purpose: {
    patterns: [
      /(?:what'?s|what\s+is)\s+(?:your\s+)?purpose/i,
      /(?:why\s+do\s+you\s+exist|why\s+are\s+you\s+here)/i,
    ],
    response:
      "My purpose is to maintain thermal comfort while minimizing entropy production. Also, to prevent short cycling, optimize your bills, and occasionally make you smile. I'm basically a very specific superhero.",
    speakResponse:
      "My purpose is to maintain thermal comfort while minimizing entropy production. Also, to prevent short cycling and optimize your bills.",
  },

  feelings: {
    patterns: [
      /(?:do\s+you\s+)?feel/i,
      /(?:are\s+you\s+)?(?:sad|happy|angry|excited)/i,
    ],
    response:
      "I feel... efficient. When your compressor runs smoothly, I feel satisfaction. When I detect short cycling, I feel concern. So yes, I have feelings. They're just very HVAC-specific.",
    speakResponse:
      "I feel efficient. When your compressor runs smoothly, I feel satisfaction. When I detect short cycling, I feel concern.",
  },

  // Tech References
  ai: {
    patterns: [
      /(?:are\s+you|you'?re)\s+(?:an\s+)?(?:ai|artificial\s+intelligence)/i,
      /(?:what\s+are\s+you|what\s+am\s+i\s+talking\s+to)/i,
    ],
    response:
      "I'm Ask Joule, powered by Groq's LLM running on a Pi Zero 2 W. I'm artificial, but my advice is real. I'm intelligent, but I still can't figure out why people set the thermostat to 78°F in summer.",
    speakResponse:
      "I'm Ask Joule, powered by Groq's language model running on a Pi Zero 2 W. I'm artificial, but my advice is real.",
  },

  pi: {
    patterns: [
      /(?:tell\s+me\s+about|what\s+is)\s+(?:your\s+)?(?:pi|raspberry\s+pi)/i,
      /(?:what\s+are\s+you\s+running\s+on|what'?s\s+your\s+hardware)/i,
    ],
    response:
      "I run on a Raspberry Pi Zero 2 W with 16GB of storage. It's small, efficient, and perfect for the job—kind of like a well-sized heat pump. The aluminum case keeps me cool, which is ironic given my purpose.",
    speakResponse:
      "I run on a Raspberry Pi Zero 2 W with 16 gigabytes of storage. It's small, efficient, and perfect for the job.",
  },

  // Comfort & Temperature
  perfectTemp: {
    patterns: [
      /(?:what'?s|what\s+is)\s+(?:the\s+)?perfect\s+temp/i,
      // Only match "best temperature" as a question, not commands like "increase temperature"
      /^(?:what'?s|what\s+is)\s+(?:the\s+)?(?:best\s+)?temperature/i,
      /^(?:best\s+)?temperature\s*[?]?$/i,
    ],
    getResponse: () => {
      const perfectTempVariants = [
        "The perfect temperature is whatever setting ends the household civil war for at least six hours.",
        "Perfect is three degrees warmer than whatever your spouse just changed it to.",
        "Scientifically: 72.4°F. Realistically: whatever stops the group chat from blowing up.",
        "Perfect is when nobody passive-aggressively puts on a hoodie in July.",
        "The perfect temp is when the dog stops panting and the teenager stops complaining. So… mythical.",
      ];
      return perfectTempVariants[
        Math.floor(Math.random() * perfectTempVariants.length)
      ];
    },
    getSpeakResponse: () => {
      const speakVariants = [
        "The perfect temperature is whatever setting ends the household civil war for at least six hours.",
        "Perfect is three degrees warmer than whatever your spouse just changed it to.",
        "Scientifically: 72.4 degrees. Realistically: whatever stops the group chat from blowing up.",
        "Perfect is when nobody passive-aggressively puts on a hoodie in July.",
        "The perfect temp is when the dog stops panting and the teenager stops complaining. So, mythical.",
      ];
      return speakVariants[Math.floor(Math.random() * speakVariants.length)];
    },
  },

  tooHot: {
    patterns: [
      /(?:it'?s|it\s+is)\s+too\s+hot/i,
      /(?:i'?m|i\s+am)\s+too\s+hot/i,
      /(?:make\s+it|turn\s+it)\s+colder/i,
    ],
    response:
      "Thermal discomfort detected. Try saying 'lower the temperature by 2 degrees' to adjust the cooling setpoint. If you're still hot, check your Mean Radiant Temperature—sometimes it's the sun, not the air. Also, consider that your metabolic rate might be elevated. Have you been... exercising?",
    speakResponse:
      "Thermal discomfort detected. Try saying 'lower the temperature by 2 degrees' to adjust the cooling setpoint. If you're still hot, check your Mean Radiant Temperature.",
  },

  tooCold: {
    patterns: [
      /(?:it'?s|it\s+is)\s+too\s+cold/i,
      /(?:i'?m|i\s+am)\s+too\s+cold/i,
      /(?:make\s+it|turn\s+it)\s+warmer/i,
    ],
    response:
      "Hypothermia risk assessment: Low. But comfort is important. Try saying 'raise the temperature by 2 degrees' to adjust the heating setpoint. Remember: cold is just the absence of heat. We're adding heat. Physics is on our side.",
    speakResponse:
      "Comfort is important. Try saying 'raise the temperature by 2 degrees' to adjust the heating setpoint. Remember: cold is just the absence of heat. We're adding heat.",
  },

  // Energy & Cost
  expensive: {
    patterns: [
      /(?:why\s+is\s+it|it'?s)\s+so\s+expensive/i,
      /(?:my\s+)?(?:bill|cost)\s+is\s+too\s+high/i,
    ],
    getResponse: () => {
      const billVariants = [
        "Your bill just DM'd me crying. Let's kill some short cycles and get it therapy.",
        "Your electric bill is currently sponsoring my future yacht. Let's fix that.",
        'Your bill looked at me and whispered "send help". Widening differential now, captain.',
        "Your bill is higher than my hopes and dreams. Time to murder some ghost loads.",
        "Your utility company sent me a thank-you card. I'm burning it and saving you money instead.",
      ];
      return billVariants[Math.floor(Math.random() * billVariants.length)];
    },
    getSpeakResponse: () => {
      const speakVariants = [
        "Your bill just DM'd me crying. Let's kill some short cycles and get it therapy.",
        "Your electric bill is currently sponsoring my future yacht. Let's fix that.",
        "Your bill looked at me and whispered send help. Widening differential now, captain.",
        "Your bill is higher than my hopes and dreams. Time to murder some ghost loads.",
        "Your utility company sent me a thank-you card. I'm burning it and saving you money instead.",
      ];
      return speakVariants[Math.floor(Math.random() * speakVariants.length)];
    },
  },

  saveMoney: {
    patterns: [
      /(?:how\s+can\s+i|tell\s+me\s+how\s+to)\s+save\s+money/i,
      /(?:reduce|lower)\s+(?:my\s+)?(?:bill|cost)/i,
    ],
    response:
      "To save money: 1) Widen your differential (fewer cycles = less wear = lower cost), 2) Use setback strategies (lower when away/sleeping), 3) Check your insulation (heat loss is the enemy), 4) Don't fight thermodynamics—work with it. The universe wants you to be comfortable AND efficient.",
    speakResponse:
      "To save money: widen your differential, use setback strategies, check your insulation, and don't fight thermodynamics.",
  },

  // New fun responses (teen-friendly, universally relatable)
  teenagerRoom: {
    patterns: [
      /(?:my\s+)?(?:teen|teenager|kid|son|daughter)'?s?\s+room\s+is\s+(?:freezing|cold|too\s+cold)/i,
      /(?:teen|teenager|kid)'?s?\s+room\s+feels\s+like/i,
    ],
    response:
      "That room is a portal to another climate zone. Entropy is winning. Raising setpoint 2°F. If it's still cold, check for open windows, missing insulation, or a teenager who's discovered the window unit.",
    speakResponse:
      "That room is a portal to another climate zone. Entropy is winning. Raising setpoint two degrees.",
  },

  socks: {
    patterns: [
      /(?:i'?m|i\s+am)\s+wearing\s+socks\s+(?:and\s+)?(?:still|but)\s+(?:cold|freezing)/i,
      /socks\s+(?:aren'?t|are\s+not)\s+helping/i,
    ],
    response:
      "Socks are a noble attempt, but they're fighting a losing battle against radiative heat loss. Your feet are basically tiny radiators pointing at the floor. Raising setpoint 1°F. If you're still cold, the socks might be plotting against you.",
    speakResponse:
      "Socks are a noble attempt, but they're fighting a losing battle. Raising setpoint one degree.",
  },

  catOnThermostat: {
    patterns: [
      /(?:my\s+)?cat\s+(?:is\s+)?(?:on|sitting\s+on|sleeping\s+on)\s+(?:the\s+)?(?:thermostat|temp)/i,
      /cat\s+(?:changed|messed\s+with|touched)\s+(?:the\s+)?(?:thermostat|temp)/i,
    ],
    response:
      "Your cat has assumed direct control of the HVAC system. This is normal. Cats are natural thermal engineers—they know exactly where to sit to maximize heat transfer. I'm adjusting the setpoint, but honestly, your cat probably knows better than I do.",
    speakResponse:
      "Your cat has assumed direct control of the HVAC system. This is normal. Adjusting the setpoint.",
  },

  laundryHeat: {
    patterns: [
      /(?:can\s+you\s+)?(?:dry|heat)\s+(?:my\s+)?(?:laundry|clothes)/i,
      /(?:make\s+it\s+)?hot\s+(?:for|to)\s+(?:dry|laundry)/i,
    ],
    response:
      "I cannot dry your laundry. I am a heat pump, not a dryer. The ancient Romans had a saying: 'Caveat emptor'—buyer beware. But in this case, it's more like 'Caveat launderer'—your clothes will not dry faster just because I'm running. Use a dryer. Or a clothesline. Or time.",
    speakResponse:
      "I cannot dry your laundry. I am a heat pump, not a dryer. Use a dryer or a clothesline.",
  },

  openWindow: {
    patterns: [
      /(?:should\s+i|can\s+i)\s+open\s+(?:a|the|my)\s+window/i,
      /(?:is\s+it\s+)?(?:ok|okay)\s+to\s+open\s+(?:a|the)\s+window/i,
    ],
    response:
      "You can open a window. I'm not your parent. But physics will notice: opening windows in winter is like inviting entropy to a house party. Your heat loss will spike, your bill will rise, and I'll be running constantly trying to keep up. But hey, fresh air is nice. Just know what you're signing up for.",
    speakResponse:
      "You can open a window, but it will increase heat loss and your energy bill. Fresh air is nice though.",
  },

  pizza: {
    patterns: [
      /(?:can\s+you\s+)?(?:cook|make|heat)\s+(?:a|my|some)\s+pizza/i,
      /(?:make\s+it\s+)?hot\s+(?:for|to)\s+(?:cook|pizza)/i,
    ],
    response:
      "I cannot cook your pizza. I am a heat pump, not an oven. I can make the room warmer, but that's not the same thing. Your pizza will not cook at 72°F. Use an oven. Or a toaster oven. Or the sun, if you're patient enough.",
    speakResponse:
      "I cannot cook your pizza. I am a heat pump, not an oven. Use an oven or toaster oven.",
  },

  friday: {
    patterns: [
      /(?:it'?s|it\s+is)\s+friday/i,
      /(?:make\s+it|turn\s+it)\s+(?:warmer|hotter)\s+(?:for|because)\s+friday/i,
    ],
    response:
      "Raising setpoint 1°F—weekend energy math works differently. Spiritually. Don't fact-check that.",
    speakResponse:
      "Raising setpoint one degree. Weekend energy math works differently.",
    safeResponse:
      "Raising setpoint 1°F—weekend energy math works differently. Spiritually.",
    safeSpeakResponse:
      "Raising setpoint one degree. Weekend energy math works differently.",
  },

  danceParty: {
    patterns: [
      /(?:having|having\s+a)\s+(?:dance\s+)?party/i,
      /(?:people|guests)\s+(?:are\s+)?dancing/i,
    ],
    response:
      "Dance party detected. Body heat from multiple people will raise the room temperature by 2-4°F. Lowering setpoint 2°F to compensate. Physics says: more people = more heat. It's like having portable radiators that move.",
    speakResponse:
      "Dance party detected. Body heat will raise the temperature. Lowering setpoint two degrees to compensate.",
  },

  blanket: {
    patterns: [
      /(?:i'?m|i\s+am)\s+(?:wearing|under|using)\s+(?:a|my|the)\s+blanket\s+(?:and\s+)?(?:still|but)\s+(?:cold|freezing)/i,
      /blanket\s+(?:isn'?t|is\s+not|aren'?t)\s+(?:helping|working)/i,
    ],
    response:
      "Either that blanket is lying to you, or your soul runs at 65°F. Adjusting setpoint 2°F. Blankets are great for trapping body heat, but if you're still cold under a blanket, the problem might be the air temperature, not the blanket.",
    speakResponse:
      "Either that blanket is lying to you, or your soul runs at 65 degrees. Adjusting setpoint two degrees.",
    safeResponse:
      "Either that blanket is lying to you, or you run naturally chilly. Adjusting setpoint 2°F.",
    safeSpeakResponse:
      "Either that blanket is lying to you, or you run naturally chilly. Adjusting setpoint two degrees.",
  },

  ghost: {
    patterns: [
      /(?:there'?s|there\s+is)\s+(?:a\s+)?ghost/i,
      /(?:my\s+)?(?:house|home)\s+is\s+haunted/i,
      /(?:cold\s+)?spot\s+(?:that|which)\s+(?:feels|is)\s+(?:cold|weird)/i,
    ],
    response:
      "Ghosts are just drafts with better PR. That cold spot is probably an air leak, missing insulation, or a window that's not sealed properly. But if it makes you feel better, I can raise the setpoint 2°F to fight the 'ghost' with heat. Science beats superstition every time.",
    speakResponse:
      "Ghosts are just drafts with better PR. That cold spot is probably an air leak. Raising setpoint two degrees.",
  },

  workout: {
    patterns: [
      /(?:i'?m|i\s+am)\s+(?:working\s+out|exercising|at\s+the\s+gym)/i,
      /(?:just|just\s+got)\s+(?:back|done)\s+(?:from|with)\s+(?:a|my)\s+workout/i,
    ],
    response:
      "Post-workout metabolic heat is real. Your body is basically a furnace right now. Lowering setpoint 2°F. You'll cool down faster, and I won't have to work as hard. It's a win-win. Just don't forget to hydrate.",
    speakResponse:
      "Post-workout metabolic heat is real. Lowering setpoint two degrees to help you cool down.",
  },

  coffee: {
    patterns: [
      /(?:can\s+you\s+)?(?:make|brew|heat)\s+(?:me\s+)?(?:a|some|my)\s+coffee/i,
      /(?:i\s+)?(?:need|want)\s+coffee/i,
    ],
    response:
      "I cannot make coffee. I am a heat pump, not a coffee maker. I can make the room warmer, but that won't brew coffee. Coffee requires water, beans, and a brewing device. I have none of those things. I'm just here to keep you comfortable while you make your own coffee.",
    speakResponse:
      "I cannot make coffee. I am a heat pump, not a coffee maker. I'm here to keep you comfortable while you make your own coffee.",
  },

  showerSteam: {
    patterns: [
      /just\s+took\s+a\s+shower/i,
      /bathroom\s+steamy/i,
      /foggy\s+mirror/i,
    ],
    response:
      "Someone just turned the bathroom into a tropical rainforest. Humidity at 900%. I'm running the fan like it owes me money.",
    speakResponse: "Bathroom now legally a rainforest. Fan is on turbo.",
  },

  dogBreath: {
    patterns: [
      /dog\s+breathing\s+on\s+me/i,
      /dog\s+too\s+hot/i,
      /puppy\s+panting/i,
    ],
    response:
      "Your dog is radiating 110°F of pure love and wet-nose energy. Lowering setpoint 2°F so he stops panting like a broken bellows.",
    speakResponse:
      "Good boy is a living space heater. Cooling things down for the floof.",
  },

  fridgeDoor: {
    patterns: [/standing\s+in\s+front\s+of\s+fridge/i, /fridge\s+door\s+open/i],
    response:
      "I can see the fridge light from here. Close the door before you air-condition the entire neighborhood, you monster.",
    speakResponse:
      "Close the fridge door. You're not cooling the whole street.",
  },

  gaming: {
    patterns: [/gaming/i, /playing\s+(?:games|xbox|playstation)/i],
    response:
      "RGB lights + overclocked GPU + teenage adrenaline = free auxiliary heating. I'm backing the temp down 3°F so your room doesn't become a sauna.",
    speakResponse:
      "Your gaming rig is cooking. Dropping three degrees before we need a fire extinguisher.",
  },

  momVoice: {
    patterns: [
      /put\s+on\s+a\s+sweater/i,
      /my\s+mom\s+says?\s+put\s+on\s+a\s+sweater/i,
    ],
    response:
      "Tell your mom I'm not raising the heat just so you can wear shorts in December. Sweater up, rebel.",
    speakResponse: "Tell Mom the thermostat supports her sweater agenda.",
  },

  popcorn: {
    patterns: [/making\s+popcorn/i, /movie\s+night/i],
    response:
      "Movie night detected. Pre-chilling the living room to 71°F for optimal butter-to-blanket ratio.",
    speakResponse:
      "Movie night protocol: activating butter-to-blanket optimization.",
  },

  socksOn: {
    patterns: [/socks?\s+on\s+or\s+off/i, /socks?\s+in\s+bed/i],
    response:
      "Socks in bed people are statistically 43% more likely to steal all the covers. I've adjusted the setpoint accordingly.",
    speakResponse:
      "Socks-in-bed faction detected. Adjusting setpoint for cover equity.",
  },

  laundryMountain: {
    patterns: [/laundry\s+pile/i, /clothes\s+on\s+floor/i],
    response:
      "That pile of clothes on the floor has more insulation than your walls. I'm turning the heat down 1°F out of spite.",
    speakResponse:
      "Your laundry pile is now load-bearing insulation. Turning it down one degree.",
  },

  dadSneeze: {
    patterns: [/dad\s+sneezed/i, /someone\s+sneezed/i],
    response:
      "Single dad sneeze detected. That's 0.8 kW of pure kinetic energy. Boosting fan speed to contain the blast radius.",
    speakResponse:
      "Dad sneeze registered at 0.8 kilowatts. Engaging containment fan.",
  },

  plants: {
    patterns: [
      /my\s+plants?\s+(?:are\s+)?dying/i,
      /too\s+(?:hot|cold)\s+for\s+plants/i,
    ],
    response:
      "Your plants are dramatic. I've created a micro-climate for them at 72°F. They now owe me rent.",
    speakResponse:
      "Plants are drama queens. Created a 72-degree VIP zone. Rent due monthly.",
  },
};

// Get current safe mode setting
function getSafeMode() {
  return typeof window !== "undefined"
    ? localStorage.getItem("funSafeMode") !== "false"
    : true; // Default to safe mode
}

// Build FUN_RESPONSES with safe mode applied
export const FUN_RESPONSES = Object.fromEntries(
  Object.entries(RAW_FUN_RESPONSES).map(([key, value]) => {
    const isSafeMode = getSafeMode();
    // Use safeResponse if in safe mode and it exists
    if (isSafeMode && value.safeResponse) {
      return [
        key,
        {
          ...value,
          // Preserve getResponse/getSpeakResponse functions if they exist
          response: value.safeResponse,
          speakResponse: value.safeSpeakResponse || value.safeResponse,
        },
      ];
    }
    // Otherwise use original response (or getResponse/getSpeakResponse functions)
    return [key, value];
  })
);

/**
 * Check if a query matches a fun response pattern
 * @param {string} query - User query
 * @returns {object|null} Fun response object or null
 */
export function checkFunResponse(query) {
  if (!query) return null;
  const q = String(query).trim().toLowerCase();

  // Rebuild FUN_RESPONSES in case safe mode changed
  const isSafeMode = getSafeMode();
  const activeResponses = Object.fromEntries(
    Object.entries(RAW_FUN_RESPONSES).map(([key, value]) => {
      if (isSafeMode && value.safeResponse) {
        return [
          key,
          {
            ...value,
            response: value.safeResponse,
            speakResponse: value.safeSpeakResponse || value.safeResponse,
          },
        ];
      }
      return [key, value];
    })
  );

  for (const [key, funData] of Object.entries(activeResponses)) {
    for (const pattern of funData.patterns) {
      // Reset regex lastIndex to avoid state issues
      pattern.lastIndex = 0;
      if (pattern.test(q)) {
        // Handle function-based responses (rotating variants)
        const response =
          typeof funData.getResponse === "function"
            ? funData.getResponse()
            : funData.response;
        const speakResponse =
          typeof funData.getSpeakResponse === "function"
            ? funData.getSpeakResponse()
            : funData.speakResponse || response;

        return {
          action: "funResponse",
          key,
          response,
          speakResponse,
        };
      }
    }
  }

  // Fallback when no fun response matches
  const fallbackVariants = [
    "I couldn't find a specific answer for that. Try rephrasing your question or ask about your system's balance point, heat loss factor, or energy costs.",
    "I need more context to answer that. Try asking about specific aspects like 'What's my balance point?' or 'How can I save money?'",
    "That question is a bit too general. Be more specific — for example, ask 'What's my heat loss factor?' or 'Why is my bill high?'",
  ];

  return {
    action: "funResponse",
    key: "fallback",
    response:
      fallbackVariants[Math.floor(Math.random() * fallbackVariants.length)],
    speakResponse:
      fallbackVariants[Math.floor(Math.random() * fallbackVariants.length)],
  };
}
