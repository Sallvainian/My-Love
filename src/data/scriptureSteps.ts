/**
 * Static Scripture Data — 17 steps with verse text, response text, section themes
 * Story 1.1: AC #5
 *
 * Source: PRD Functional Requirements
 * All verses are NKJV. Response texts are couple-focused response prayers.
 * 6 section themes: Healing & Restoration, Forgiveness & Reconciliation,
 * Confession & Repentance, God's Faithfulness & Peace, The Power of Words,
 * Christlike Character.
 */

export const MAX_STEPS = 17;

export interface ScriptureStep {
  stepIndex: number;
  sectionTheme: string;
  verseReference: string;
  verseText: string;
  responseText: string;
}

export const SCRIPTURE_STEPS: readonly ScriptureStep[] = [
  // Section 1: Healing & Restoration (Steps 0-2)
  {
    stepIndex: 0,
    sectionTheme: 'Healing & Restoration',
    verseReference: 'Psalm 147:3',
    verseText:
      'He heals the brokenhearted and binds up their wounds.',
    responseText:
      'Lord, we ask You to heal the broken places in our hearts and in our marriage. Bind up the wounds we have caused each other, and restore what has been damaged. We trust in Your power to make all things new.',
  },
  {
    stepIndex: 1,
    sectionTheme: 'Healing & Restoration',
    verseReference: 'Jeremiah 30:17',
    verseText:
      '"For I will restore health to you and heal you of your wounds," says the Lord.',
    responseText:
      'Father, we claim Your promise of restoration. Heal us from the wounds of harsh words, broken trust, and unmet expectations. Restore health to our relationship as only You can.',
  },
  {
    stepIndex: 2,
    sectionTheme: 'Healing & Restoration',
    verseReference: 'Isaiah 61:3',
    verseText:
      'To give them beauty for ashes, the oil of joy for mourning, the garment of praise for the spirit of heaviness.',
    responseText:
      'God, take the ashes of our pain and create something beautiful. Replace our mourning with joy and our heaviness with praise. Let our marriage be a testimony of Your redemptive power.',
  },

  // Section 2: Forgiveness & Reconciliation (Steps 3-5)
  {
    stepIndex: 3,
    sectionTheme: 'Forgiveness & Reconciliation',
    verseReference: 'Colossians 3:13',
    verseText:
      'Bearing with one another, and forgiving one another, if anyone has a complaint against another; even as Christ forgave you, so you also must do.',
    responseText:
      'Lord, give us the grace to forgive as You have forgiven us. Help us bear with one another in love, releasing bitterness and choosing reconciliation. Teach us to forgive not just with words, but from the heart.',
  },
  {
    stepIndex: 4,
    sectionTheme: 'Forgiveness & Reconciliation',
    verseReference: 'Ephesians 4:32',
    verseText:
      'And be kind to one another, tenderhearted, forgiving one another, even as God in Christ forgave you.',
    responseText:
      'Father, soften our hearts toward each other. Where we have grown cold or distant, restore tenderness. Help us be kind in our words and actions, choosing forgiveness over resentment.',
  },
  {
    stepIndex: 5,
    sectionTheme: 'Forgiveness & Reconciliation',
    verseReference: 'Matthew 6:14-15',
    verseText:
      'For if you forgive men their trespasses, your heavenly Father will also forgive you. But if you do not forgive men their trespasses, neither will your Father forgive your trespasses.',
    responseText:
      'Lord, we recognize that unforgiveness imprisons us. Free us from the chains of resentment. Help us release the hurts we hold against each other, knowing that in forgiving, we ourselves are set free.',
  },

  // Section 3: Confession & Repentance (Steps 6-8)
  {
    stepIndex: 6,
    sectionTheme: 'Confession & Repentance',
    verseReference: 'James 5:16',
    verseText:
      'Confess your trespasses to one another, and pray for one another, that you may be healed. The effective, fervent prayer of a righteous man avails much.',
    responseText:
      'God, give us the courage to be honest with each other. Help us confess where we have fallen short — not to condemn, but to heal. As we pray for one another, bring the healing that only transparency and grace can provide.',
  },
  {
    stepIndex: 7,
    sectionTheme: 'Confession & Repentance',
    verseReference: '1 John 1:9',
    verseText:
      'If we confess our sins, He is faithful and just to forgive us our sins and to cleanse us from all unrighteousness.',
    responseText:
      'Father, we confess our shortcomings before You and before each other. We have been selfish, impatient, and unkind. Cleanse us and give us a fresh start. Thank You for Your faithfulness to forgive.',
  },
  {
    stepIndex: 8,
    sectionTheme: 'Confession & Repentance',
    verseReference: 'Psalm 51:10',
    verseText:
      'Create in me a clean heart, O God, and renew a steadfast spirit within me.',
    responseText:
      'Lord, create clean hearts in both of us. Remove the pride, defensiveness, and stubbornness that hinder our growth. Renew a steadfast, committed spirit within us — one that perseveres through difficulty.',
  },

  // Section 4: God's Faithfulness & Peace (Steps 9-11)
  {
    stepIndex: 9,
    sectionTheme: "God's Faithfulness & Peace",
    verseReference: 'Philippians 4:6-7',
    verseText:
      'Be anxious for nothing, but in everything by prayer and supplication, with thanksgiving, let your requests be made known to God; and the peace of God, which surpasses all understanding, will guard your hearts and minds through Christ Jesus.',
    responseText:
      'Lord, we lay our anxieties about our marriage at Your feet. Guard our hearts and minds with Your peace — a peace that goes beyond our circumstances. Help us bring everything to You in prayer rather than carrying it alone.',
  },
  {
    stepIndex: 10,
    sectionTheme: "God's Faithfulness & Peace",
    verseReference: 'Lamentations 3:22-23',
    verseText:
      'Through the Lord\'s mercies we are not consumed, because His compassions fail not. They are new every morning; great is Your faithfulness.',
    responseText:
      'Father, thank You that Your mercies are new every morning. No matter what yesterday held, today is a fresh start. Great is Your faithfulness to us, and we trust You to be faithful in our marriage.',
  },
  {
    stepIndex: 11,
    sectionTheme: "God's Faithfulness & Peace",
    verseReference: 'Isaiah 26:3',
    verseText:
      'You will keep him in perfect peace, whose mind is stayed on You, because he trusts in You.',
    responseText:
      'God, help us fix our minds on You rather than on our problems. When conflict arises, anchor us in Your peace. Teach us to trust You with our marriage, knowing that You are working all things together for our good.',
  },

  // Section 5: The Power of Words (Steps 12-14)
  {
    stepIndex: 12,
    sectionTheme: 'The Power of Words',
    verseReference: 'Proverbs 18:21',
    verseText:
      'Death and life are in the power of the tongue, and those who love it will eat its fruit.',
    responseText:
      'Lord, we recognize the power our words have over each other. Help us speak life, encouragement, and truth. Guard our tongues from words that wound, and fill our mouths with words that build up.',
  },
  {
    stepIndex: 13,
    sectionTheme: 'The Power of Words',
    verseReference: 'Ephesians 4:29',
    verseText:
      'Let no corrupt word proceed out of your mouth, but what is good for necessary edification, that it may impart grace to the hearers.',
    responseText:
      'Father, set a guard over our mouths. Let every word we speak to each other be purposeful — building up, not tearing down. May our conversations impart grace and reflect Your love.',
  },
  {
    stepIndex: 14,
    sectionTheme: 'The Power of Words',
    verseReference: 'Proverbs 15:1',
    verseText:
      'A soft answer turns away wrath, but a harsh word stirs up anger.',
    responseText:
      'God, in moments of frustration, help us choose soft answers. When we want to respond harshly, give us the self-control to pause and speak with gentleness. Transform our communication patterns to reflect Your wisdom.',
  },

  // Section 6: Christlike Character (Steps 15-16)
  {
    stepIndex: 15,
    sectionTheme: 'Christlike Character',
    verseReference: '1 Corinthians 13:4-7',
    verseText:
      'Love suffers long and is kind; love does not envy; love does not parade itself, is not puffed up; does not behave rudely, does not seek its own, is not provoked, thinks no evil; does not rejoice in iniquity, but rejoices in the truth; bears all things, believes all things, hopes all things, endures all things.',
    responseText:
      'Lord, shape our love to look like Yours. Make us patient and kind. Remove envy, pride, and selfishness from our hearts. Help us keep no record of wrongs and always protect, trust, hope, and persevere in our love for each other.',
  },
  {
    stepIndex: 16,
    sectionTheme: 'Christlike Character',
    verseReference: 'Galatians 5:22-23',
    verseText:
      'But the fruit of the Spirit is love, joy, peace, longsuffering, kindness, goodness, faithfulness, gentleness, self-control. Against such there is no law.',
    responseText:
      'Father, produce the fruit of Your Spirit in our marriage. Fill us with love, joy, and peace. Grant us patience, kindness, and goodness toward each other. Make us faithful, gentle, and self-controlled. Let our marriage be a garden where Your fruit flourishes.',
  },
] as const;
