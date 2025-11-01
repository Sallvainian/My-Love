import type { Message } from '../types';

/**
 * 100 pre-written sweet messages for the girlfriend
 * These are suggestions that can be edited/customized
 */

type DefaultMessage = Omit<Message, 'id' | 'createdAt' | 'isCustom'>;

const reasons: DefaultMessage[] = [
  { text: "I love how your smile lights up the entire room when you're genuinely happy.", category: 'reason', isFavorite: false },
  { text: "Your kindness to strangers shows me the beautiful person you are inside.", category: 'reason', isFavorite: false },
  { text: "The way you laugh at your own jokes before the punchline makes me fall for you all over again.", category: 'reason', isFavorite: false },
  { text: "I love how passionate you are about the things you care about.", category: 'reason', isFavorite: false },
  { text: "Your strength and resilience inspire me every single day.", category: 'reason', isFavorite: false },
  { text: "The little dance you do when you're excited is the cutest thing I've ever seen.", category: 'reason', isFavorite: false },
  { text: "I love how you always see the best in people, even when it's hard to find.", category: 'reason', isFavorite: false },
  { text: "Your intelligence and the way you think about the world fascinates me.", category: 'reason', isFavorite: false },
  { text: "The sound of your voice is my favorite sound in the whole world.", category: 'reason', isFavorite: false },
  { text: "I love how you're not afraid to be yourself, always and completely.", category: 'reason', isFavorite: false },
  { text: "Your creativity amazes me - you see beauty and possibility everywhere.", category: 'reason', isFavorite: false },
  { text: "The way you care for others without expecting anything in return shows your beautiful soul.", category: 'reason', isFavorite: false },
  { text: "I love your sense of humor and how you can make me laugh even on my worst days.", category: 'reason', isFavorite: false },
  { text: "Your eyes sparkle when you talk about your dreams, and it makes me want to help you achieve every single one.", category: 'reason', isFavorite: false },
  { text: "I love how comfortable silence feels when I'm with you.", category: 'reason', isFavorite: false },
  { text: "The way you scrunch your nose when you're confused is adorable beyond words.", category: 'reason', isFavorite: false },
  { text: "Your determination and work ethic push me to be a better person.", category: 'reason', isFavorite: false },
  { text: "I love how you remember the little things I tell you.", category: 'reason', isFavorite: false },
  { text: "Your gentle heart and the way you care for everything around you is beautiful.", category: 'reason', isFavorite: false },
  { text: "The way you support my dreams makes me feel like I can conquer anything.", category: 'reason', isFavorite: false },
];

const memories: DefaultMessage[] = [
  { text: "Remember our first date? I was so nervous, but you made everything feel easy and natural.", category: 'memory', isFavorite: false },
  { text: "That time we got lost on our road trip and ended up finding that amazing little cafe - best detour ever.", category: 'memory', isFavorite: false },
  { text: "I'll never forget the first time you said 'I love you' - my heart still skips a beat thinking about it.", category: 'memory', isFavorite: false },
  { text: "Dancing in the kitchen at midnight while making late-night snacks is one of my favorite memories.", category: 'memory', isFavorite: false },
  { text: "The way you held my hand during that scary movie - I felt so safe with you.", category: 'memory', isFavorite: false },
  { text: "Remember when we stayed up all night just talking? I could listen to you forever.", category: 'memory', isFavorite: false },
  { text: "That sunset we watched together - the view was beautiful, but I couldn't stop looking at you.", category: 'memory', isFavorite: false },
  { text: "The first time you met my family and charmed everyone without even trying.", category: 'memory', isFavorite: false },
  { text: "That rainy day we spent inside playing games and laughing - perfection doesn't need sunshine.", category: 'memory', isFavorite: false },
  { text: "Remember our first kiss? Time stopped, and in that moment, I knew you were special.", category: 'memory', isFavorite: false },
  { text: "The way you surprised me on my birthday showed me how well you truly know me.", category: 'memory', isFavorite: false },
  { text: "That time we tried to cook together and made a complete mess but laughed the entire time.", category: 'memory', isFavorite: false },
  { text: "Walking hand in hand through the park, no destination, just us and endless conversation.", category: 'memory', isFavorite: false },
  { text: "The first morning I woke up next to you - I never wanted that moment to end.", category: 'memory', isFavorite: false },
  { text: "Remember when we stayed in bed all day just being lazy together? Those are the moments I treasure.", category: 'memory', isFavorite: false },
  { text: "That inside joke that still makes us laugh no matter how many times we repeat it.", category: 'memory', isFavorite: false },
  { text: "The way you comforted me when I was going through a tough time - I'll never forget your support.", category: 'memory', isFavorite: false },
  { text: "Our spontaneous adventure to that place we'd never been - every moment with you is an adventure.", category: 'memory', isFavorite: false },
  { text: "The day we decided to be 'us' - best decision I ever made.", category: 'memory', isFavorite: false },
  { text: "Remember how nervous we both were at the beginning? Look how far we've come.", category: 'memory', isFavorite: false },
];

const affirmations: DefaultMessage[] = [
  { text: "You are beautiful, inside and out, and don't let anyone tell you otherwise.", category: 'affirmation', isFavorite: false },
  { text: "You are stronger than you know, braver than you believe, and more amazing than you realize.", category: 'affirmation', isFavorite: false },
  { text: "Your worth is not determined by anyone else's opinion - you are inherently valuable.", category: 'affirmation', isFavorite: false },
  { text: "Today, remember that you are capable of achieving anything you set your mind to.", category: 'affirmation', isFavorite: false },
  { text: "You deserve all the love and happiness in the world.", category: 'affirmation', isFavorite: false },
  { text: "Your dreams are valid, your goals are achievable, and your potential is limitless.", category: 'affirmation', isFavorite: false },
  { text: "You make the world a better place just by being in it.", category: 'affirmation', isFavorite: false },
  { text: "It's okay to rest - you don't have to be perfect all the time.", category: 'affirmation', isFavorite: false },
  { text: "You are loved more than you know, especially by me.", category: 'affirmation', isFavorite: false },
  { text: "Your feelings are valid, your thoughts matter, and your voice deserves to be heard.", category: 'affirmation', isFavorite: false },
  { text: "You are enough, exactly as you are, right now.", category: 'affirmation', isFavorite: false },
  { text: "The way you handle challenges shows incredible strength and grace.", category: 'affirmation', isFavorite: false },
  { text: "You have a gift for making others feel special and appreciated.", category: 'affirmation', isFavorite: false },
  { text: "Today is another opportunity to be the amazing person you already are.", category: 'affirmation', isFavorite: false },
  { text: "You bring joy and light to everyone around you, especially me.", category: 'affirmation', isFavorite: false },
  { text: "Your kindness is a superpower that changes lives, including mine.", category: 'affirmation', isFavorite: false },
  { text: "You are doing better than you think, and I'm so proud of you.", category: 'affirmation', isFavorite: false },
  { text: "The world needs your unique talents and perspective.", category: 'affirmation', isFavorite: false },
  { text: "You have the courage to face whatever comes your way.", category: 'affirmation', isFavorite: false },
  { text: "Remember: you are loved, you are valued, and you are irreplaceable.", category: 'affirmation', isFavorite: false },
];

const future: DefaultMessage[] = [
  { text: "I can't wait to wake up next to you every morning for the rest of our lives.", category: 'future', isFavorite: false },
  { text: "Someday we'll look back on these days as 'the beginning' of our beautiful story.", category: 'future', isFavorite: false },
  { text: "I'm excited to build a life with you, filled with love, laughter, and adventure.", category: 'future', isFavorite: false },
  { text: "I can't wait to travel the world with you and create memories in every corner of the globe.", category: 'future', isFavorite: false },
  { text: "Growing old with you is my favorite future to imagine.", category: 'future', isFavorite: false },
  { text: "I look forward to all the ordinary moments we'll share - they're extraordinary with you.", category: 'future', isFavorite: false },
  { text: "One day we'll have our own place, our own traditions, our own little world together.", category: 'future', isFavorite: false },
  { text: "I can't wait to support all your dreams and watch you achieve everything you want.", category: 'future', isFavorite: false },
  { text: "Someday we'll sit on our porch and laugh about all the adventures we've had together.", category: 'future', isFavorite: false },
  { text: "I'm excited for every sunrise we'll watch together and every sunset we'll share.", category: 'future', isFavorite: false },
  { text: "All the plans we're making, all the dreams we're building - I want it all with you.", category: 'future', isFavorite: false },
  { text: "I can't wait for all the holidays, birthdays, and special moments we'll celebrate together.", category: 'future', isFavorite: false },
  { text: "Looking forward to a lifetime of inside jokes that nobody else understands.", category: 'future', isFavorite: false },
  { text: "I want to be by your side through every season of life, supporting each other always.", category: 'future', isFavorite: false },
  { text: "Imagine all the stories we'll have to tell someday about our life together.", category: 'future', isFavorite: false },
  { text: "I'm excited for lazy Sunday mornings with coffee and you for the rest of forever.", category: 'future', isFavorite: false },
  { text: "Can't wait to build a home together - not just a house, but a place filled with our love.", category: 'future', isFavorite: false },
  { text: "Every tomorrow is brighter because I know you'll be in it.", category: 'future', isFavorite: false },
  { text: "I look forward to dancing in the kitchen with you when we're old and grey.", category: 'future', isFavorite: false },
  { text: "All my future plans include you - you're my forever.", category: 'future', isFavorite: false },
];

const special: DefaultMessage[] = [
  { text: "Good morning, beautiful! Today is another day to be amazing, and you already are.", category: 'affirmation', isFavorite: false },
  { text: "Just a reminder that you're on my mind today and always. Hope you're smiling right now because that's my favorite thing.", category: 'reason', isFavorite: false },
  { text: "You're the first person I think of when I wake up and the last one on my mind before I sleep.", category: 'reason', isFavorite: false },
  { text: "Thank you for being you - imperfectly perfect and absolutely wonderful.", category: 'affirmation', isFavorite: false },
  { text: "If I could give you one thing, it would be the ability to see yourself through my eyes. Then you'd realize how truly special you are.", category: 'affirmation', isFavorite: false },
  { text: "You are my sunshine on cloudy days, my calm in the storm, my home.", category: 'reason', isFavorite: false },
  { text: "Every love song makes sense now because I have you.", category: 'reason', isFavorite: false },
  { text: "I never knew I was missing anything until I found everything in you.", category: 'reason', isFavorite: false },
  { text: "You're not just my girlfriend - you're my best friend, my confidant, my everything.", category: 'reason', isFavorite: false },
  { text: "Life with you is an adventure I never want to end.", category: 'future', isFavorite: false },
  { text: "You make ordinary moments feel magical just by being there.", category: 'reason', isFavorite: false },
  { text: "Thank you for loving me on my bad days and celebrating with me on my good days.", category: 'memory', isFavorite: false },
  { text: "With you, I'm home. No matter where we are.", category: 'reason', isFavorite: false },
  { text: "You've changed my life in the best possible way, and I'm grateful every day.", category: 'affirmation', isFavorite: false },
  { text: "Your love makes me want to be the best version of myself.", category: 'reason', isFavorite: false },
  { text: "I love you not only for what you are but for what I am when I'm with you.", category: 'reason', isFavorite: false },
  { text: "You're the answer to questions I didn't even know I was asking.", category: 'reason', isFavorite: false },
  { text: "Every day with you is my new favorite day.", category: 'memory', isFavorite: false },
  { text: "You're proof that soulmates exist.", category: 'reason', isFavorite: false },
  { text: "I love you more than yesterday, less than tomorrow, and that will never change.", category: 'future', isFavorite: false },
];

// Combine all messages
export const defaultMessages: DefaultMessage[] = [
  ...reasons,
  ...memories,
  ...affirmations,
  ...future,
  ...special,
];

// Export by category for easy filtering
export const messagesByCategory = {
  reason: reasons,
  memory: memories,
  affirmation: affirmations,
  future: future,
  special: special,
};

export default defaultMessages;
