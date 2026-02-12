// Outings Configuration
// Shared configuration for all 2026 outings data
// Used by both NextOuting component and ScorecardPage

const OutingsConfig = {
  // Hardcoded list of all 2026 outings (in order)
  // Index 0 = Outing 1, Index 1 = Outing 2, etc.
  OUTINGS_2026: [
    {
      imagePath: "assets/images/2026-PowerscourtE.png",
      clubUrl: "https://powerscourtgolfclub.com/",
      mapsUrl: "https://www.google.com/maps/place/Powerscourt+Golf+Club/@53.1871659,-6.1887573,17z/data=!3m1!4b1!4m6!3m5!1s0x4867a6fd021be2a7:0xc798d69aa9fc22df!8m2!3d53.1871627!4d-6.1861824!16zL20vMGZkeDZ0?entry=ttu",
      clubName: "Powerscourt Golf Club",
      courseName: "Powerscourt East"
    },
    {
      imagePath: "assets/images/2026-Corballis.png",
      clubUrl: "https://corballislinks.com/",
      mapsUrl: "https://www.google.com/maps/place/Corballis+Links+Golf+Club/@53.4724031,-6.1278454,17z/data=!3m1!4b1!4m6!3m5!1s0x48671a4c6020b10d:0xbedd6398801af469!8m2!3d53.4723999!4d-6.1252705!16s%2Fg%2F1tfwjsc8?entry=ttu",
      clubName: "Corballis Links Golf Club",
      courseName: "Corballis Links"
    },
    {
      imagePath: "assets/images/2026-Newlands.png",
      clubUrl: "https://www.newlandsgolfclub.com/",
      mapsUrl: "https://maps.app.goo.gl/Er9aR4qtjuNZyDneA",
      clubName: "Newlands Golf Club",
      courseName: "Newlands"
    },
    {
      imagePath: "assets/images/2026-ConcraWood.png",
      clubUrl: "https://www.concrawood.ie/",
      mapsUrl: "https://www.google.com/maps/place/Concra+Wood+Golf+%26+Country+Club/@54.1103894,-6.7064642,16.82z/data=!4m6!3m5!1s0x4860ba4627e189d7:0xc40a624cf0e45886!8m2!3d54.1105889!4d-6.7039142!16s%2Fg%2F1tg1544p?entry=ttu",
      clubName: "Concra Wood Golf & Country Club",
      courseName: "Concra Wood"
    },
    {
      imagePath: "assets/images/2026-Balcarrick.png",
      clubUrl: "https://www.balcarrickgolfclub.com/",
      mapsUrl: "https://maps.app.goo.gl/yJkonw4iGbXfzwrs9",
      clubName: "Balcarrick Golf Club",
      courseName: "Balcarrick"
    },
    {
      imagePath: "assets/images/2026-KilkeeCAstle.png",
      clubUrl: "https://www.kilkeacastle.ie/golf/",
      mapsUrl: "https://maps.app.goo.gl/zu1GgD2BedzoW9bA8",
      clubName: "Kilkee Castle Golf",
      courseName: "Kilkee Castle"
    },
    {
      imagePath: "assets/images/2026-PowerscourtWb.png",
      clubUrl: "https://powerscourtgolfclub.com/",
      mapsUrl: "https://maps.app.goo.gl/Z9pY6dJk77nePoFo6",
      clubName: "Powerscourt Golf Club",
      courseName: "Powerscourt West"
    },
    {
      imagePath: "assets/images/2026-Rathsallagh.png",
      clubUrl: "https://www.rathsallaghcountryclub.com/",
      mapsUrl: "https://www.google.com/maps/place/Rathsallagh+Golf+%26+Country+Club/@53.0259224,-6.7415216,17z/data=!3m1!4b1!4m6!3m5!1s0x486787e1c851f801:0x3e35a37c0c26d7ce!8m2!3d53.0259192!4d-6.7389467!16s%2Fg%2F1td6m25n?entry=ttu",
      clubName: "Rathsallagh Golf & Country Club",
      courseName: "Rathsallagh"
    },
    {
      imagePath: "assets/images/2026-Newbridge.png",
      clubUrl: "https://newbridgegolfclub.com/",
      mapsUrl: "https://www.google.com/maps/place/Newbridge+Golf+Club/@53.2041365,-6.787302,17z/data=!3m1!4b1!4m6!3m5!1s0x48677ff0fbe06c4d:0xb87aa7094e19781f!8m2!3d53.2041333!4d-6.7847271!16s%2Fg%2F1tdqn1_9?entry=ttu",
      clubName: "Newbridge Golf Club",
      courseName: "Newbridge"
    },
    {
      imagePath: "assets/images/2026-Beaverstown.png",
      clubUrl: "https://www.beaverstown.com/",
      mapsUrl: "https://www.google.com/maps/place/Beaverstown+Golf+Club/@53.4979394,-6.1537109,17z/data=!3m1!4b1!4m6!3m5!1s0x4867198f2e139433:0x6f3ebccc7356cf3a!8m2!3d53.4979362!4d-6.151136!16s%2Fg%2F1vl9qxqp?entry=ttu",
      clubName: "Beaverstown Golf Club",
      courseName: "Beaverstown"
    }
  ],

  /**
   * Strip common suffixes from club names (Golf Club, Country Club, etc.)
   * @param {string} clubName - Full club name
   * @returns {string} Stripped club name
   */
  stripClubNameSuffixes: function(clubName) {
    if (!clubName) return '';
    
    // Remove common suffixes (case-insensitive)
    let stripped = clubName
      .replace(/\s+Golf\s+Club\s*$/i, '')
      .replace(/\s+Country\s+Club\s*$/i, '')
      .replace(/\s+Golf\s+&\s+Country\s+Club\s*$/i, '')
      .replace(/\s+Golf\s*$/i, '')
      .replace(/\s+Links\s*$/i, '')
      .trim();
    
    return stripped;
  },

  /**
   * Map a club name to a course key used in the scorecard
   * @param {string} clubName - Full club name
   * @returns {string|null} Course key or null if no match found
   */
  mapClubNameToCourseKey: function(clubName) {
    if (!clubName) return null;
    
    const stripped = this.stripClubNameSuffixes(clubName);
    const lowerStripped = stripped.toLowerCase().replace(/\s+/g, '');
    
    // Mapping of stripped club names to course keys in scorecard
    // Only includes courses that actually exist in the scorecard courses object
    const mapping = {
      'concr wood': 'Concra Wood',        // "Concra Wood" -> "ConcraWood"
      'concrawood': 'Concra Wood',       // Alternative spelling
      'balcarrick': 'Balcarrick',
      'kilkee castle': 'Kilkea Castle',  // "Kilkee Castle" -> "KilkeaCastle" (note spelling difference)
      'kilkeacastle': 'Kilkea Castle',
      'rathsallagh': 'Rathsllagh',      // "Rathsallagh" -> "Rathsllagh" (note: typo in scorecard - one 'l')
      'rathsllagh': 'Rathsllagh',       // Alternative spelling
      'newbridge': 'Newbridge',
      'powerscourt': 'Powerscourt West',      // "Powerscourt Golf Club" -> "Powerscourt"
      'powerscourteast': 'Powerscourt East',  // Powerscourt East course
      'powerscourtwest': 'Powerscourt West',  // Powerscourt West course
      'powerscourtwa': 'Powerscourt East',    // Powerscourt Wa (East)
      'powerscourtwb': 'Powerscourt West'     // Powerscourt Wb (West)
    };
    
    // Try exact match first (case-insensitive, no spaces)
    if (mapping[lowerStripped]) {
      return mapping[lowerStripped];
    }
    
    // Try partial match - check if any mapping key is contained in the stripped name
    for (const [key, value] of Object.entries(mapping)) {
      if (lowerStripped.includes(key) || key.includes(lowerStripped)) {
        return value;
      }
    }
    
    // Try matching against the original stripped name (with spaces)
    const mappingWithSpaces = {
      'Concra Wood': 'ConcraWood',
      'Balcarrick': 'Balcarrick',
      'Kilkee Castle': 'KilkeaCastle',
      'Rathsallagh': 'Rathsllagh',
      'Newbridge': 'Newbridge',
      'Powerscourt': 'Powerscourt',
      'Powerscourt East': 'PowerscourtEast',
      'Powerscourt West': 'PowerscourtWest'
    };
    
    if (mappingWithSpaces[stripped]) {
      return mappingWithSpaces[stripped];
    }
    
    // Case-insensitive match with spaces
    for (const [key, value] of Object.entries(mappingWithSpaces)) {
      if (key.toLowerCase() === stripped.toLowerCase()) {
        return value;
      }
    }
    
    return null;
  }
};
