-- V4 — the opening Passage catalogue.
--
-- Content ships as a migration, not as a seeding script run by hand, so that a
-- clone-and-run database is a playable one and every environment holds the same
-- Passages under the same ids-by-text. A Passage Leaderboard is meaningless if
-- the row it ranks means different words on staging and in production.
--
-- Everything here is out of copyright or a short attributed quotation. Two
-- house rules, both enforced by the constraints in V3 rather than by care:
--
--   * printable ASCII only. Source texts are full of curly quotes, em dashes
--     and ellipsis characters, and a player cannot type any of them. Every one
--     has been transliterated -- em dash to `--`, curly to straight.
--   * an attribution on every Passage. In the Quotes Discipline it is shown
--     beside the words, and a quotation nobody said is not a quotation.
--
-- Dollar quoting rather than doubled apostrophes: these are prose, apostrophes
-- are everywhere in them, and `''` in the middle of a sentence is where a typo
-- hides.

INSERT INTO passages (discipline, text, attribution) VALUES

-- ---------------------------------------------------------------- Quotes ----

('QUOTES',
 $q$The only thing we have to fear is fear itself -- nameless, unreasoning, unjustified terror which paralyzes needed efforts to convert retreat into advance.$q$,
 $q$Franklin D. Roosevelt, First Inaugural Address, 1933$q$),

('QUOTES',
 $q$It is not the critic who counts; not the man who points out how the strong man stumbles, or where the doer of deeds could have done them better. The credit belongs to the man who is actually in the arena.$q$,
 $q$Theodore Roosevelt, Citizenship in a Republic, 1910$q$),

('QUOTES',
 $q$You have power over your mind, not outside events. Realize this, and you will find strength. Waste no more time arguing about what a good man should be. Be one.$q$,
 $q$Marcus Aurelius, Meditations$q$),

('QUOTES',
 $q$The Analytical Engine has no pretensions whatever to originate anything. It can do whatever we know how to order it to perform. It can follow analysis; but it has no power of anticipating any analytical relations or truths.$q$,
 $q$Ada Lovelace, Notes on the Analytical Engine, 1843$q$),

('QUOTES',
 $q$I believe that at the end of the century the use of words and general educated opinion will have altered so much that one will be able to speak of machines thinking without expecting to be contradicted. We can only see a short distance ahead, but we can see plenty there that needs to be done.$q$,
 $q$Alan Turing, Computing Machinery and Intelligence, 1950$q$),

('QUOTES',
 $q$The most damaging phrase in the language is: it's always been done that way. Humans are allergic to change, and I try to fight that. That is why I keep a clock on my wall that runs counter-clockwise.$q$,
 $q$Grace Hopper$q$),

('QUOTES',
 $q$Simplicity is prerequisite for reliability. The computing scientist's main challenge is not to get confused by the complexities of his own making. Program testing can be used to show the presence of bugs, but never to show their absence.$q$,
 $q$Edsger W. Dijkstra$q$),

('QUOTES',
 $q$In anything at all, perfection is finally attained not when there is no longer anything to add, but when there is no longer anything to take away, when a body has been stripped down to its nakedness.$q$,
 $q$Antoine de Saint-Exupery, Wind, Sand and Stars$q$),

('QUOTES',
 $q$Four score and seven years ago our fathers brought forth on this continent a new nation, conceived in liberty, and dedicated to the proposition that all men are created equal.$q$,
 $q$Abraham Lincoln, The Gettysburg Address, 1863$q$),

('QUOTES',
 $q$If you know the enemy and know yourself, you need not fear the result of a hundred battles. If you know yourself but not the enemy, for every victory gained you will also suffer a defeat.$q$,
 $q$Sun Tzu, The Art of War, translated by Lionel Giles$q$),

('QUOTES',
 $q$It is not that we have a short time to live, but that we waste a lot of it. Life is long enough, and a sufficiently generous amount has been given to us for the highest achievements if it were all well invested.$q$,
 $q$Seneca, On the Shortness of Life$q$),

('QUOTES',
 $q$Nothing in life is to be feared, it is only to be understood. Now is the time to understand more, so that we may fear less. I am among those who think that science has great beauty.$q$,
 $q$Marie Curie$q$),

-- ----------------------------------------------------------------- Prose ----

('PROSE',
 $q$Call me Ishmael. Some years ago -- never mind how long precisely -- having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world. It is a way I have of driving off the spleen and regulating the circulation.$q$,
 $q$Herman Melville, Moby-Dick, 1851$q$),

('PROSE',
 $q$It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.$q$,
 $q$Jane Austen, Pride and Prejudice, 1813$q$),

('PROSE',
 $q$It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness, it was the spring of hope, it was the winter of despair.$q$,
 $q$Charles Dickens, A Tale of Two Cities, 1859$q$),

('PROSE',
 $q$The sea-reach of the Thames stretched before us like the beginning of an interminable waterway. In the offing the sea and the sky were welded together without a joint, and in the luminous space the tanned sails of the barges drifting up with the tide seemed to stand still in red clusters of canvas sharply peaked, with gleams of varnished sprits.$q$,
 $q$Joseph Conrad, Heart of Darkness, 1899$q$),

('PROSE',
 $q$It was on a dreary night of November that I beheld the accomplishment of my toils. With an anxiety that almost amounted to agony, I collected the instruments of life around me, that I might infuse a spark of being into the lifeless thing that lay at my feet.$q$,
 $q$Mary Shelley, Frankenstein, 1818$q$),

('PROSE',
 $q$I remember him as if it were yesterday, as he came plodding to the inn door, his sea-chest following behind him in a hand-barrow, a tall, strong, heavy, nut-brown man, his tarry pigtail falling over the shoulder of his soiled blue coat.$q$,
 $q$Robert Louis Stevenson, Treasure Island, 1883$q$),

('PROSE',
 $q$To Sherlock Holmes she is always the woman. I have seldom heard him mention her under any other name. In his eyes she eclipses and predominates the whole of her sex. It was not that he felt any emotion akin to love for Irene Adler.$q$,
 $q$Arthur Conan Doyle, A Scandal in Bohemia, 1891$q$),

('PROSE',
 $q$The Time Traveller, for so it will be convenient to speak of him, was expounding a recondite matter to us. His pale grey eyes shone and twinkled, and his usually pale face was flushed and animated. The fire burned brightly, and the soft radiance of the incandescent lights caught the bubbles that flashed and passed in our glasses.$q$,
 $q$H. G. Wells, The Time Machine, 1895$q$),

('PROSE',
 $q$The voice of the sea is seductive; never ceasing, whispering, clamouring, murmuring, inviting the soul to wander for a spell in abysses of solitude; to lose itself in mazes of inward contemplation. The touch of the sea is sensuous, enfolding the body in its soft, close embrace.$q$,
 $q$Kate Chopin, The Awakening, 1899$q$),

('PROSE',
 $q$I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach, and not, when I came to die, discover that I had not lived.$q$,
 $q$Henry David Thoreau, Walden, 1854$q$);
