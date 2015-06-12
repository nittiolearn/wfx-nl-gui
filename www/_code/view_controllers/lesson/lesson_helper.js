(function() {

//-------------------------------------------------------------------------------------------------
// player.js:
// Lesson player module
//-------------------------------------------------------------------------------------------------
function module_init() {
    angular.module('nl.lesson_helper', [])
    .service('nlLessonHelperSrv', LessonHelperSrv);
}

//-------------------------------------------------------------------------------------------------
var LessonHelperSrv = ['nl',
function(nl) {
    var markupParser = new MarkupParser(nl);
    _initBgTemplates();

    this.getIconList = function() {
        return _iconList;
    };

    this.getBgTemplateList = function() {
        return _bgTemplateList;
    };

    this.getIconUrl = function(iconId) {
        var url = null;
        if (markupParser.check(iconId, 'img:')) {
            markupParser.parse(iconId, 'img:', function(urlPart, avpairs) {
                url = urlPart;
            });
        } else {
            url = nl.url.lessonIconUrl(iconId);
        }
        return url;
    };

    this.getBackgroundUrlInfo = function(templateId) {
        var ret = {url:null, bgShade:'bglight'};
        if (markupParser.check(templateId, 'img:')) {
            markupParser.parse(templateId, 'img:', function(urlPart, avpairs) {
                ret.url = urlPart;
                for(var k in avpairs) ret.bgShade = k;
            });
        } else if (templateId in _bgTemplateDir) {
            var t = _bgTemplateDir[templateId];
            ret.url = nl.url.bgImgUrl(t.background);
            ret.bgShade = t.bgShade;
        }
        return ret;
    };

}];

function MarkupParser(nl) {

    this.check = function(str, markup) {
        var re = new RegExp(nl.fmt2('^\\s*{}', markup));
        if (str.match(re)) return true;
        return false;
    };
    
    this.parse = function(line, marker, fn) {
        var regex=new RegExp(nl.fmt2('({})([^\\[]*)(\\[.*?\\])?', marker), 'g');
        return line.replace(regex, function(match, mark, link, param, offset, allstr) {
            param = (typeof param === 'string' && param !== '') ? param.substring(1, param.length-1) : '';
            link = (typeof link !== 'string') ? '' : link;
            var params = param.split('|');
            var avpairs = {};
            for (var i in params) {
                var avpair = params[i].split('=');
                if (avpair.length != 2) {
                    avpairs[params[i]] = '';
                    continue;
                }
                avpairs[avpair[0]] = avpair[1];
            }
            return fn(link, avpairs, mark);
        });
    };
}

var _bgTemplateDir = {};
function _initBgTemplates() {
    for(var i=0; i<_bgTemplateList.length; i++) {
        var t = _bgTemplateList[i];
        _bgTemplateDir[t.id] = t;
    }    
}

var _iconList = [{id:'Custom', name:'Custom', group:''},
    {id:'NittioSun.png', name:'Nittio Sun', group:''}, 

    {id:'Eng2.png', name:'Learn Language', group:'Languages'}, 
    {id:'Eng1.png', name:'Learn English - 1', group:'Languages'}, 
    {id:'Eng3.png', name:'Learn English - 2', group:'Languages'}, 
    {id:'Eng4.png', name:'Learn English - 3', group:'Languages'}, 
    {id:'hindi2.png', name:'Learn Hindi - 1', group:'Languages'}, 
    {id:'hindi1.png', name:'Learn Hindi - 2', group:'Languages'}, 
    {id:'kannada1.png', name:'Learn Kannada - 1', group:'Languages'}, 
    {id:'kannada2.png', name:'Learn Kannada - 2', group:'Languages'}, 
    {id:'Tamil.png', name:'Learn Tamil', group:'Languages'}, 
    {id:'Malayalam.png', name:'Learn Malayalam', group:'Languages'}, 
    {id:'Sanskrit.png', name:'Learn Sanskrit', group:'Languages'}, 
    {id:'Telugu.png', name:'Learn Telugu', group:'Languages'}, 
    {id:'french1.png', name:'Learn French - 1', group:'Languages'}, 
    {id:'french2.png', name:'Learn French - 2', group:'Languages'}, 
    {id:'Italian.png', name:'Learn Italian', group:'Languages'}, 
    {id:'German.png', name:'Learn German', group:'Languages'}, 
    {id:'Spanish.png', name:'Spanish Flag', group:'Languages'}, 
    {id:'Chinese.png', name:'Chinese', group:'Languages'}, 
    {id:'SpellColors.png', name:'Spell Colors', group:'Languages'}, 
    {id:'ShootChute.png', name:'Shoot and Chute', group:'Languages'}, 
    {id:'Math3.png', name:'Learn Math - 1', group:'Math'}, 
    {id:'Math4.png', name:'Learn Math - 2', group:'Math'}, 
    {id:'Math1.png', name:'Math Symbols', group:'Math'}, 
    {id:'Math2.png', name:'Math Shapes - 1', group:'Math'}, 
    {id:'Math6.png', name:'Math Shapes - 2', group:'Math'}, 
    {id:'Math5.png', name:'Math Geometry - 1', group:'Math'}, 
    {id:'Math7.png', name:'Math Geometry - 2', group:'Math'}, 
    {id:'PlaceValue.png', name:'Math Numbers and Charts', group:'Math'}, 
    {id:'Math8.png', name:'Math Clock', group:'Math'}, 
    
    {id:'science-lab.png', name:'Science Lab', group:'Science'}, 
    {id:'science-bio.png', name:'Science DNA', group:'Science'}, 
    {id:'science-humanbody1.png', name:'Science Human Brain 1', group:'Science'}, 
    {id:'science-basic-brain.png', name:'Science Human Brain 2', group:'Science'}, 
    {id:'science-humanbody2.png', name:'Science Human Lungs', group:'Science'}, 
    {id:'WaterCycle.png', name:'Science Rain Clouds', group:'Science'}, 
    {id:'science-basic-evolution.png', name:'Science Evolution', group:'Science'}, 
    {id:'science-basic-microscope.png', name:'Science Microscope', group:'Science'}, 
    
    {id:'science-physics1.png', name:'Physics Atoms', group:'Physics'}, 
    {id:'physics-emc2.png', name:'Physics Formula', group:'Physics'}, 
    {id:'science-speedometer.png', name:'Physics Speedometer 1', group:'Physics'}, 
    {id:'Speedometer.png', name:'Physics Speedometer 2', group:'Physics'},
    {id:'science-physics2.png', name:'Physics Magnet 1', group:'Physics'}, 
    {id:'physics-magnet.png', name:'Physics Magnet 2', group:'Physics'}, 
    {id:'science-physics3.png', name:'Physics Compass', group:'Physics'}, 
    
    {id:'chemistry-molecules.png', name:'Chemistry Molecule 1', group:'Chemistry'}, 
    {id:'chemistry-molecules-grey.png', name:'Chemistry Molecule 2', group:'Chemistry'}, 
    {id:'chemistry-molecules-color.png', name:'Chemistry Molecule 3', group:'Chemistry'}, 
    {id:'chemistry-experiment.png', name:'Chemistry Experiment', group:'Chemistry'}, 
    {id:'chemistry-testtube.png', name:'Chemistry Testtube Experiment', group:'Chemistry'}, 
    {id:'science-basic-beaker.png', name:'Chemistry Beaker Experiment 1', group:'Chemistry'}, 
    {id:'chemistry-beaker-experiment.png', name:'Chemistry Beaker Experiment 2', group:'Chemistry'}, 
    
    {id:'science-lifescience3.png', name:'Biology Cells', group:'Biology'}, 
    {id:'science-lifescience2.png', name:'Biology Flower - 1', group:'Biology'}, 
    {id:'science-lifescience1.png', name:'Biology Flower - 2', group:'Biology'}, 
    {id:'science-lifescience4.png', name:'Biology Flower - 3', group:'Biology'}, 
    {id:'Frog.png', name:'Biology Frog', group:'Biology'}, 
    {id:'Sheep.png', name:'Biology Sheep', group:'Biology'}, 
      
    {id:'history1.png', name:'History Gandhiji', group:'History'}, 
    {id:'history-gandhiji.png', name:'History Gandhiji and flag', group:'History'}, 
    {id:'history-greek1.png', name:'History Monk', group:'History'}, 
    {id:'history3.png', name:'History Western', group:'History'}, 
    {id:'history-british.png', name:'History Western Horse', group:'History'}, 
    {id:'history-greek-king.png', name:'History Roman', group:'History'}, 
    {id:'history2.png', name:'History Roman Colosseum', group:'History'}, 
    {id:'history4.png', name:'History Egyptian Mummy', group:'History'}, 
    {id:'history-arab.png', name:'History Egyptian - Camel in desert', group:'History'}, 
    {id:'history-greek.png', name:'History Greek', group:'History'}, 
      
    {id:'geography1.png', name:'Geography World Map', group:'Geography and Environment'}, 
    {id:'geography2.png', name:'Geography Globe Blue Brown Africa', group:'Geography and Environment'}, 
    {id:'geography3.png', name:'Geography Globe Blue Green America', group:'Geography and Environment'}, 
    {id:'GlobeBrown.png', name:'Geography Globe Protect', group:'Geography and Environment'}, 
    {id:'GlobeGreen.png', name:'Geography Globe Flags', group:'Geography and Environment'}, 
    {id:'geography4.png', name:'Geography Globe Latitude Logitude', group:'Geography and Environment'}, 
    {id:'geography-internet.png', name:'Geography Globe Mouse', group:'Geography and Environment'}, 
    {id:'geography-note.png', name:'Geography Globe Notes', group:'Geography and Environment'}, 
    {id:'geography-globeorange.png', name:'Geography Globe Orange', group:'Geography and Environment'}, 
      
    {id:'computerscience1.png', name:'Computer Desktop 1', group:'Computers and Devices'}, 
    {id:'computerscience2.png', name:'Computer Desktop 2', group:'Computers and Devices'}, 
    {id:'computer-devices.png', name:'Computer Devices', group:'Computers and Devices'}, 
    {id:'computer-laptop.png', name:'Computer Laptop', group:'Computers and Devices'}, 
    {id:'computer-laptop-penguin.png', name:'Computer Laptop Penguin', group:'Computers and Devices'}, 
    {id:'computer-signal.png', name:'Mobile Signal', group:'Computers and Devices'}, 
    {id:'computer-mobile.png', name:'Mobile Phone', group:'Computers and Devices'}, 
    {id:'computer-tablet.png', name:'Kiddy Tablet', group:'Computers and Devices'}, 
      
    {id:'commerce-economics1.png', name:'Chart growth', group:'Commerce, Economics, Finance and Business'}, 
    {id:'commerce-economics2.png', name:'Shopping Cart', group:'Commerce, Economics, Finance and Business'}, 
    {id:'commerce-economics3.png', name:'Money Bag', group:'Commerce, Economics, Finance and Business'}, 
    {id:'commerce-economics4.png', name:'Currencies', group:'Commerce, Economics, Finance and Business'}, 
    {id:'commerce-economics-house.png', name:'Money House', group:'Commerce, Economics, Finance and Business'}, 
    {id:'commerce-economics-manwithbag.png', name:'Money Bag', group:'Commerce, Economics, Finance and Business'}, 
    {id:'commerce-economics-coins.png', name:'Coins', group:'Commerce, Economics, Finance and Business'}, 
    {id:'commerce-economics-note.png', name:'Notes and Coins', group:'Commerce, Economics, Finance and Business'}, 
    {id:'commerce-economics-graph.png', name:'Graph', group:'Commerce, Economics, Finance and Business'}, 
    {id:'commerce-economics-piggybank.png', name:'Piggy Bank', group:'Commerce, Economics, Finance and Business'}, 
    {id:'commerce-economics-industries.png', name:'Industries', group:'Commerce, Economics, Finance and Business'}, 
    {id:'commerce-economics-profitbag.png', name:'Profit', group:'Commerce, Economics, Finance and Business'}, 
      
    {id:'music1.png', name:'Music 1', group:'Arts and Sports'}, 
    {id:'music2.png', name:'Music 2', group:'Arts and Sports'}, 
    {id:'music-gitar.png', name:'Music Guitar', group:'Arts and Sports'}, 
    {id:'music-recorder.png', name:'Music Recorder', group:'Arts and Sports'}, 
    {id:'dance.png', name:'Dance', group:'Arts and Sports'}, 
    {id:'sports1.png', name:'Sports Football 1', group:'Arts and Sports'}, 
    {id:'sports-football.png', name:'Sports Football 2', group:'Arts and Sports'}, 
    {id:'sports2.png', name:'Sports Tennis', group:'Arts and Sports'}, 
    {id:'sports3.png', name:'Sports Cap', group:'Arts and Sports'},
    {id:'sports-skating.png', name:'Sports Skating', group:'Arts and Sports'}, 
    {id:'sports-running.png', name:'Sports Running', group:'Arts and Sports'}, 
    
    {id:'general-pin.png', name:'Pin', group:'General'}, 
    {id:'general-pinandnotepad.png', name:'Post it', group:'General'}, 
    {id:'general-lamp.png', name:'Lamp', group:'General'}, 
    {id:'general-penguin.png', name:'Penguin', group:'General'}, 
    {id:'general-folder.png', name:'Folder', group:'General'}, 
    {id:'general-news.png', name:'News', group:'General'}, 
    {id:'general-pencil.png', name:'Pencil', group:'General'}, 
    {id:'general-frog.png', name:'Frog Splash', group:'General'}, 
    {id:'general-time.png', name:'Hour Glass', group:'General'}, 
    {id:'general-microscope.png', name:'Search Lens', group:'General'}, 
    
    {id:'Kiddie123.png', name:'Kiddy 123', group:'Kids Collection'},
    {id:'KiddieABC.png', name:'Kiddy ABC', group:'Kids Collection'},
    {id:'KiddieApple.png', name:'Kiddy Apple', group:'Kids Collection'},
    {id:'KiddieBee.png', name:'Kiddy Bee', group:'Kids Collection'},
    {id:'KiddieBigSmall.png', name:'Kiddy Big & Small', group:'Kids Collection'},
    {id:'KiddieBlocks.png', name:'Kiddy Blocks', group:'Kids Collection'},
    {id:'KiddieBoyGirl.png', name:'Kiddy Girl and Boy', group:'Kids Collection'},
    {id:'Boygirl.png', name:'Kiddy Boy and Girl', group:'Kids Collection'}, 
    {id:'KiddieBoy.png', name:'Kiddy Boy', group:'Kids Collection'},
    {id:'KiddieBug.png', name:'Kiddy Bug', group:'Kids Collection'},
    {id:'KiddieBugRed.png', name:'Kiddy Red Bug', group:'Kids Collection'},
    {id:'KiddieButterfly.png', name:'Kiddy Butterfly', group:'Kids Collection'},
    {id:'KiddieCake.png', name:'Kiddy Cake', group:'Kids Collection'},
    {id:'KiddieCap.png', name:'Kiddy Cap', group:'Kids Collection'},
    {id:'KiddieCat.png', name:'Kiddy Cat', group:'Kids Collection'},
    {id:'KiddieColor.png', name:'Kiddy Color', group:'Kids Collection'},
    {id:'KiddieCry.png', name:'Kiddy Cry', group:'Kids Collection'},
    {id:'KiddieElephant.png', name:'Kiddy Elephant', group:'Kids Collection'},
    {id:'KiddieFish.png', name:'Kiddy Fish', group:'Kids Collection'},
    {id:'KiddieFlower.png', name:'Kiddy Flower', group:'Kids Collection'},
    {id:'KiddieGirl.png', name:'Kiddy Girl', group:'Kids Collection'},
    {id:'KiddieGoat.png', name:'Kiddy Goat', group:'Kids Collection'},
    {id:'KiddieGoodHabits.png', name:'Kiddy GoodHabits', group:'Kids Collection'},
    {id:'KiddieHen.png', name:'Kiddy Hen', group:'Kids Collection'},
    {id:'KiddieMonkey.png', name:'Kiddy Monkey', group:'Kids Collection'},
    {id:'KiddieOrange.png', name:'Kiddy Orange', group:'Kids Collection'},
    {id:'KiddieOwl.png', name:'Kiddy Owl', group:'Kids Collection'},
    {id:'KiddiePenguin.png', name:'Kiddy Penguin', group:'Kids Collection'},
    {id:'Time.png', name:'Kids Penguin Time', group:'Kids Collection'},
    {id:'KiddieSun.png', name:'Kiddy Sun', group:'Kids Collection'},
    {id:'KiddieTree.png', name:'Kiddy Tree', group:'Kids Collection'},
    {id:'KiddieZebra.png', name:'Kiddy Zebra', group:'Kids Collection'},
    {id:'CnC.png', name:'C and C', group:'Kids Collection'}, 
    {id:'CubeRedWeight.png', name:'Cube Red', group:'Kids Collection'}, 
    
    {id:'BeigeBalloons.png', name:'Beige Balloons', group:'Kidie - Ballons'}, 
    {id:'BlackBalloons.png', name:'Black Balloons', group:'Kidie - Ballons'}, 
    {id:'BlueBalloons.png', name:' Blue Balloons', group:'Kidie - Ballons'}, 
    {id:'BrownBalloons.png', name:'Brown Balloons', group:'Kidie - Ballons'}, 
    {id:'GrayBalloons.png', name:'Gray Balloons', group:'Kidie - Ballons'}, 
    {id:'GreenBalloons.png', name:'Green Balloons', group:'Kidie - Ballons'}, 
    {id:'OrangeBalloons.png', name:'Orange Balloons', group:'Kidie - Ballons'}, 
    {id:'PinkBalloons.png', name:'Pink Balloons', group:'Kidie - Ballons'}, 
    {id:'PurpleBalloons.png', name:'Purple Balloons', group:'Kidie - Ballons'}, 
    {id:'RedBalloons.png', name:'Red Balloons', group:'Kidie - Ballons'}, 
    {id:'WhiteBalloons.png', name:'White Balloons', group:'Kidie - Ballons'}, 
    {id:'YellowBalloons.png', name:'Yellow Balloons', group:'Kidie - Ballons'}];

var _bgTemplateList = [
    {id:'Custom', name:'Custom', bgShade:'bgdark', background:'none.png', group:''},
    
    {id:'BoardGrasshopper', name:'Board Grasshopper Green', bgShade:'bgdark', background:'board-grasshopper.png', group:'Classic Boards'},
    {id:'BoardBlackClassic', name:'Board Classic Black', bgShade:'bgdark', background:'board-classic.png', group:'Classic Boards'},
    {id:'BoardNight', name:'Board Night Black', bgShade:'bgdark', background:'board-night.png', group:'Classic Boards'},
    {id:'BoardGentleGreen', name:'Board Gentle Green', bgShade:'bglight', 'background' : 'board-gentlegreen.png', group:'Classic Boards'},
    {id:'BoardOcean', name:'Board Ocean Blue', bgShade:'bgdark', background:'board-ocean.png', group:'Classic Boards'},
    {id:'BoardOrange', name:'Board Orange', bgShade:'bgdark', background:'board-orange.png', group:'Classic Boards'},
    {id:'BoardPearl', name:'Board Pearl', bgShade:'bglight', background:'board-pearl.png', group:'Classic Boards'},
    
    {id:'MathClassic', name:'Math Classic Gray', bgShade:'bgdark', background:'math-classic.png', group:'Math and Science'},
    {id:'MathLab', name:'Math Lab Gray', bgShade:'bgdark', background:'math-lab.png', group:'Math and Science'},
    {id:'MathPearl', name:'Math Pearl', bgShade:'bglight', background:'math-pearl.png', group:'Math and Science'},
    {id:'MathSky', name:'Math Sky Blue', bgShade:'bglight', background:'math-sky.png', group:'Math and Science'},
    {id:'ScienceLab', name:'Science Black', bgShade:'bgdark', background:'science-lab.png', group:'Math and Science'},
    {id:'SciencePearl', name:'Science Pearl', bgShade:'bglight', background:'science-pearl.png', group:'Math and Science'},
    
    {id:'GeoClassic', name:'Map Classic Gray', bgShade:'bgdark', background:'geo-classic.png', group:'Maps and Globes'},
    {id:'GeoPearl', name:'Map Pearl', bgShade:'bglight', background:'geo-pearl.png', group:'Maps and Globes'},
    {id:'GeoMap' , name:'Map - Gray and Blue', bgShade:'bglight', background:'geography-map.png', group:'Maps and Globes'},
    
    {id:'HistGandhiji' , name:'Gandhiji - White', bgShade:'bglight', background:'history-gandhiji.png', group:'Languages and Humanities'},
    {id:'SkyScraper', name:'Sky Scraper Pale Pink', bgShade:'bglight', background:'sky-scraper.png', group:'Languages and Humanities'},
    {id:'KidFlower' , name:'Flower - Violet', bgShade:'bgdark', background:'kid-flower.png', group:'Languages and Humanities'},
    {id:'Language1' , name:'Eco Paper - White', bgShade:'bglight', background:'language-general1.png', group:'Languages and Humanities'},
    {id:'Language2' , name:'Flower - Blue', bgShade:'bglight', background:'language-general2.png', group:'Languages and Humanities'},
    {id:'Language3' , name:'Woody - Brown', bgShade:'bgdark', background:'language-general3.png', group:'Languages and Humanities'},
    {id:'Language5' , name:'Rectangles - White', bgShade:'bglight', background:'language-general5.png', group:'Languages and Humanities'},
    {id:'Language6' , name:'Border Design - Yellow', bgShade:'bglight', background:'language-general6.png', group:'Languages and Humanities'},
    
    {id:'KidBalloon' , name:'Kiddy Balloons - Green', bgShade:'bglight', background:'kid-baloon.png', group:'Kiddy'},
    {id:'KidGarden' , name:'Kiddy Garden - Blue', bgShade:'bglight', background:'kid-garden.png', group:'Kiddy'},
    {id:'KidGardenLeaves' , name:'Kiddy Autumn - Blue', bgShade:'bglight', background:'kid-gardenleaves.png', group:'Kiddy'},
    {id:'KidGrass' , name:'Kiddy Grass - Green', bgShade:'bglight', background:'kid-grass.png', group:'Kiddy'},
    {id:'KidRabbit' , name:'Kiddy Rabbit - Dark Brown', bgShade:'bgdark', background:'kid-rabbit.png', group:'Kiddy'},
    {id:'KidSmilie' , name:'Kiddy Smilie - White', bgShade:'bglight', background:'kid-simlie.png', group:'Kiddy'},
    {id:'KidTrain' , name:'Kiddy Train - Light Green', bgShade:'bglight', background:'kid-train.png', group:'Kiddy'},
    {id:'KidPark', name:'Kiddy Park Dull', bgShade:'bglight', background:'kid-park.png', group:'Kiddy'},
    {id:'KidParkBright', name:'Kiddy Park Bright', bgShade:'bglight', background:'kid-parkbright.png', group:'Kiddy'},
    {id:'KidSnow', name:'Kiddy Snow Dull', bgShade:'bglight', background:'kid-snow.png', group:'Kiddy'},
    {id:'KidSnowBright', name:'Kiddy Snow Bright', bgShade:'bglight', background:'kid-snowbright.png', group:'Kiddy'},
    {id:'KidSpring', name:'Kiddy Spring Dull', bgShade:'bglight', background:'kid-spring.png', group:'Kiddy'},
    {id:'KidSpringBright', name:'Kiddy Spring Bright', bgShade:'bglight', background:'kid-springbright.png', group:'Kiddy'},
    
    {id:'OfficialNittio', name:'Official Nittio', bgShade:'bgdark', background:'official-nittio.png', group:'Official'},
    {id:'OfficialAbstract1' , name:'Pink Waves - White', bgShade:'bglight', background:'official-abstract1.png', group:'Official'},
    {id:'OfficialAbstract2' , name:'Yellow Waves - White', bgShade:'bglight', background:'official-abstract2.png', group:'Official'},
    {id:'OfficialAbstract3' , name:'Purple Waves - White', bgShade:'bglight', background:'official-abstract3.png', group:'Official'},
    {id:'OfficialBubbles' , name:'Bubbles - White', bgShade:'bglight', background:'official-bubbles.png', group:'Official'},
    {id:'OfficialLeaves' , name:'Leaves - White', bgShade:'bglight', background:'official-leaves.png', group:'Official'},
    {id:'OfficialSwirl' , name:'Yellow on Black', bgShade:'bgdark', background:'official-swirl.png', group:'Official'},
    {id:'None', name:'None', bgShade:'bglight', background:'none.png', group:''}];

//-------------------------------------------------------------------------------------------------
module_init();
}());
