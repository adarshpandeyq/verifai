export interface CorpusEntry {
  id: string;
  title: string;
  publisher: string;
  date: string | null;
  tags: string[];
  passage: string;
}

export const LOCAL_CORPUS: CorpusEntry[] = [
  {
    id: "kb-recycled-images",
    title: "Recycled images are not event confirmation",
    publisher: "Local demonstration corpus",
    date: null,
    tags: [
      "image",
      "flood",
      "flooding",
      "airport",
      "fire",
      "earthquake",
      "today",
      "yesterday",
      "viral",
      "photo",
    ],
    passage:
      "A photograph that visually matches a claim (for example, standing water near aircraft or a terminal) does not prove that the depicted place is the named location, nor that the event happened on the claimed date. Disaster images are frequently reused in later posts. Verification requires independent sourcing, not visual resemblance alone.",
  },
  {
    id: "kb-airport-closures",
    title: "Airport closures require an operator or regulator notice",
    publisher: "Local demonstration corpus",
    date: null,
    tags: [
      "airport",
      "closed",
      "closure",
      "shut",
      "shutdown",
      "flooding",
      "flood",
      "mumbai",
      "heathrow",
      "flight",
    ],
    passage:
      "Complete airport shutdowns are operational events announced by the airport operator, civil aviation authority, or airlines. Weather photographs, traffic delays, or waterlogging of approach roads are not equivalent to a full closure of runways and terminals. Claims that an airport was “completely shut today” cannot be confirmed from an unsourced image.",
  },
  {
    id: "kb-mumbai-airport",
    title: "Chhatrapati Shivaji Maharaj International Airport",
    publisher: "Local demonstration corpus",
    date: null,
    tags: ["mumbai", "airport", "bombay", "csmia", "india"],
    passage:
      "Mumbai’s international airport (CSMIA) is a major operating hub. Seasonal monsoon rain regularly causes disruption in the city, but disruption is not identical to a total airport shutdown. Local waterlogging photographs circulate every monsoon and are a frequent source of overstated captions.",
  },
  {
    id: "kb-eiffel",
    title: "The Eiffel Tower remains a standing Paris landmark",
    publisher: "Local demonstration corpus",
    date: "1889-03-31",
    tags: ["eiffel", "tower", "paris", "france", "dismantled", "destroyed", "collapsed"],
    passage:
      "The Eiffel Tower was completed in 1889 and remains an intact, standing monument in Paris. It has not been dismantled, demolished, or destroyed. Viral posts claiming the tower was taken down overnight contradict the well-established public status of the landmark.",
  },
  {
    id: "kb-statue-liberty",
    title: "Statue of Liberty",
    publisher: "Local demonstration corpus",
    date: "1886-10-28",
    tags: ["statue of liberty", "new york", "liberty island"],
    passage:
      "The Statue of Liberty stands on Liberty Island in New York Harbor. Extraordinary claims that it has been removed, sold, or destroyed require extraordinary evidence from official US park authorities, which a social post does not constitute.",
  },
  {
    id: "kb-taj-mahal",
    title: "Taj Mahal",
    publisher: "Local demonstration corpus",
    date: null,
    tags: ["taj mahal", "agra", "india"],
    passage:
      "The Taj Mahal in Agra is a protected monument. Claims of sudden demolition or sale are a recurring hoax pattern and should be treated as false unless confirmed by the Archaeological Survey of India.",
  },
  {
    id: "kb-water-boiling",
    title: "Boiling point of water at standard pressure",
    publisher: "Local demonstration corpus",
    date: null,
    tags: [
      "water",
      "boils",
      "boiling",
      "100",
      "celsius",
      "centigrade",
      "atmospheric",
      "pressure",
      "science",
    ],
    passage:
      "At standard atmospheric pressure (1 atm / 101.325 kPa), pure water boils at 100°C (212°F). The boiling point falls at higher altitude as pressure decreases. This is established physical chemistry, not a breaking news event.",
  },
  {
    id: "kb-sun-east",
    title: "Apparent sunrise direction",
    publisher: "Local demonstration corpus",
    date: null,
    tags: ["sun", "rise", "west", "east", "tomorrow"],
    passage:
      "On Earth, the Sun appears to rise in the east and set in the west because of planetary rotation. Claims that the Sun will rise in the west tomorrow contradict basic astronomy unless they refer to a specific optical illusion, which should be stated explicitly.",
  },
  {
    id: "kb-coffee-cancer",
    title: "Coffee is not a universal cancer cure",
    publisher: "Local demonstration corpus",
    date: null,
    tags: ["coffee", "cancer", "cure", "who", "world health"],
    passage:
      "Coffee is not a cure for all cancers. The World Health Organization’s IARC has evaluated coffee and does not classify it as a cancer treatment. Biomedical claims of a universal cure require clinical evidence; a social post is not a substitute for that evidence.",
  },
  {
    id: "kb-vaccines",
    title: "Vaccines and disease prevention",
    publisher: "Local demonstration corpus",
    date: null,
    tags: ["vaccine", "vaccines", "autism", "microchip", "covid"],
    passage:
      "Licensed vaccines are among the most studied medical interventions. Claims that routine vaccines cause the diseases they prevent, implant microchips, or are a guaranteed 100% risk-free cure-all are inconsistent with the medical consensus. Individual adverse events are monitored by regulators and do not validate conspiracy framing.",
  },
  {
    id: "kb-who",
    title: "World Health Organization communications",
    publisher: "Local demonstration corpus",
    date: null,
    tags: ["who", "world health organization", "pandemic", "declared"],
    passage:
      "WHO declarations and guidance are published on who.int and through member-state channels. Screenshots of unofficial graphics are a common vector for fabricated WHO announcements.",
  },
  {
    id: "kb-earth-round",
    title: "Shape of the Earth",
    publisher: "Local demonstration corpus",
    date: null,
    tags: ["earth", "flat", "round", "globe", "nasa"],
    passage:
      "Earth is an oblate spheroid. This is established by geodesy, satellite imagery, circumnavigation, and physics. Claims that NASA or governments recently “admitted the Earth is flat” are false.",
  },
  {
    id: "kb-media-literacy",
    title: "Captioned footage vs. the event named in the caption",
    publisher: "Local demonstration corpus",
    date: null,
    tags: ["video", "footage", "clip", "ukraine", "gaza", "war", "protest"],
    passage:
      "Combat, protest, and disaster footage is routinely miscaptioned with the wrong city, year, or conflict. Matching smoke, rubble, or crowds to a caption is not geolocation. Reverse image search, landmark matching, and primary reporting are required.",
  },
  {
    id: "kb-elections",
    title: "Election outcome claims",
    publisher: "Local demonstration corpus",
    date: null,
    tags: ["election", "votes", "stolen", "landslide", "winner"],
    passage:
      "National election results are certified by electoral authorities. Landslide or “stolen election” claims in a social post, especially without a jurisdiction and date, cannot be verified from the post itself.",
  },
  {
    id: "kb-celebrity-death",
    title: "Celebrity death hoaxes",
    publisher: "Local demonstration corpus",
    date: null,
    tags: ["died", "dead", "killed", "rip", "celebrity"],
    passage:
      "Celebrity death hoaxes are a long-running social media pattern. A portrait image plus a caption is not an obituary. Confirmation requires a family statement, reputable newsroom, or official record.",
  },
  {
    id: "kb-climate",
    title: "Weather is not climate, and one photo is not a trend",
    publisher: "Local demonstration corpus",
    date: null,
    tags: ["climate", "global warming", "snow", "heatwave", "record"],
    passage:
      "A single snowy day does not disprove global warming, and a single heatwave photograph does not by itself establish a planetary record. Climate claims need datasets, not isolated images.",
  },
  {
    id: "kb-sydney-opera",
    title: "Sydney Opera House",
    publisher: "Local demonstration corpus",
    date: null,
    tags: ["sydney", "opera house", "australia", "collapsed", "sunk"],
    passage:
      "The Sydney Opera House remains a standing, operating performing-arts centre. Claims that it sank, collapsed overnight, or was demolished are inconsistent with its public status.",
  },
  {
    id: "kb-white-house",
    title: "White House",
    publisher: "Local demonstration corpus",
    date: null,
    tags: ["white house", "washington", "president", "evacuated", "destroyed"],
    passage:
      "The White House is a continuously covered public building. Extraordinary claims of destruction or secret sale would be reported immediately by multiple national newsrooms and official channels.",
  },
];
