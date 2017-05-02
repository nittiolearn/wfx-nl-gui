njs_autovoice = function() {

var _canAutoPlay = true; // Common across auto voice and audio manager

function _getVoiceButtonDom(holder, img) {
    return jQuery('<span class="voiceButton navigator"></span>');
}

var iconToCls = {
    'buffering.icon': 'ion-load-a',
    'play.icon': 'ion-volume-medium',
    'pause.icon': 'ion-pause'
};

function _setVoiceButtonIcon(button, icon) {
    button.html('');
    var voiceIcon = njs_helper.fmt2('<i class="icon {}"></icon>', iconToCls[icon]);
    button.append(voiceIcon);
}
    
//#############################################################################################
// auto voice feature: functionality is divided in the following main classes:
// AutoVoice - the only exported class from this module - one can create a button giving
//             the auto voice text and embed anywhere one likes. Can call play for any
//             automatic playing.
//
// VoiceSynth - does the core job of play, pause, resume, stop.
//
// UtterranceSplitter - Splits the text to set of uttrable texts
//
// Voices - helps in choosing the most suited system voice for a given scenario
//#############################################################################################
var _autoVoice = null;
function getAutoVoice() {
    if (!_autoVoice) _autoVoice = new AutoVoice();
    return _autoVoice;
}

var _audioManager = null;
function getAudioManager() {
    if (!_audioManager) _audioManager = new AudioManager();
    return _audioManager;
}

//#############################################################################################
function AutoVoice() {
    var self = this;
    var _pauseCount = 0;
    
    this.ok = function() {
        return self.voiceSynth.ok();
    };
    
    this.setStartPause = function(pauseCount) {
        _pauseCount = pauseCount;
    };
    
    this.getVoiceButton = function(audioText) {
        return _getVoiceButton(audioText);
    };
    
    this.stop = function() {
        return self.voiceSynth.stop();
    };
    
    function _init() {
        self.voiceSynth = new VoiceSynth();
    }
    
    function _getVoiceButton(audioText) {
        var button = {state: 'none'}; // none | playing | paused
        button.html = _getVoiceButtonDom();
        _updateIcon(button);
        button.html.on('click', function () {
            _onButtonClick(button, audioText);
        });
        button.play = function() {
            button.state = 'none';
            if (_canAutoPlay) {
                _onButtonClick(button, audioText);
            } else {
                _updateIcon(button);
            }
        };
        return button;
    };
    
    function _updateIcon(button) {
        var prefix = nittio.getStaticResFolder();
        if (button.state == 'none' || button.state == 'paused') {
            _setVoiceButtonIcon(button.html, 'play.icon');
        } else {
            _setVoiceButtonIcon(button.html, 'pause.icon');
        }
    }

    function _startAutoVoice(button, audioText) {
        // Add a little pause at start
        var pause ='';
        for (var i=0; i<_pauseCount; i++) pause += ' \n';
        audioText = pause + audioText;
        self.voiceSynth.speak(audioText, {
            onEnd: function() {
                _onEnd(button);
            }
        });
    }
    
    function _onButtonClick(button, audioText) {
        if (button.state == 'none' || button.state == 'paused') {
            _startAutoVoice(button, audioText);
            _canAutoPlay = true;
            button.state = 'playing';
        } else if (button.state == 'playing') {
            self.voiceSynth.pause();
            _canAutoPlay = false;
            button.state = 'paused';
        } else {
            self.voiceSynth.resume();
            _canAutoPlay = true;
            button.state = 'playing';
        }
        _updateIcon(button);
    }
    
    function _onEnd(button) {
        button.state = 'none';
        _updateIcon(button);
    }
    
    _init();
}

//#############################################################################################
function VoiceSynth() {
    var self = this;

    this.ok = function() {
        return self.initDone;
    };

    this.speak = function(audioText, params) {
        if (!self.initDone) return false;
        
        window.speechSynthesis.cancel();
        var splitter = new UtterranceSplitter();
        var items = splitter.split(audioText);
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var voice = self.voices.getBestFitSystemVoice(item.voice, item.lang);

            //Create utterance object
            var utterance = new SpeechSynthesisUtterance();
            utterance.voice = voice;
            utterance.voiceURI = voice ? voice.voiceURI : '';
            utterance.volume = item.volume || 1;
            utterance.rate = item.rate || 1;
            utterance.pitch = item.pitch || 1;
            utterance.text = item.text;
            utterance.lang = item.lang || voice.lang;
            if (i == items.length - 1) {
                utterance.onend = params.onEnd;
                utterance.addEventListener('end', params.onEnd);
            }
            speechSynthesis.speak(utterance);
        }
    };

    this.pause = function() {
        if (!self.initDone) return;
        window.speechSynthesis.pause();
    };

    this.resume = function() {
        if (!self.initDone) return;
        window.speechSynthesis.resume();
    };

    this.stop = function() {
        if (!self.initDone) return;
        window.speechSynthesis.cancel();
    };
    
    self.initDone = false;
    function _init() {
        if (!window.speechSynthesis) {
            console.error('Voice synthesis not supported - automated voice will not play');
            return;
        }
        self.voices = new Voices();
        self.initDone = true;
    }
    
    _init();
}

//#############################################################################################
function UtterranceSplitter() {
    var self = this;
    var MAX_CHARS = 100;
    
    var config = {voice: ['female',  'हिन्दी'], lang: 'hi', volume: 1, rate: 1, pitch: 1};

    this.split = function(text) {
        var splitList = [];
        var lines = text.split('\n');
        for(var i=0; i<lines.length; i++) {
            _splitLine(lines[i], splitList);
        }
        return splitList;
    };
    
    function _splitLine(line, splitList) {
        while(line.length > 0) {
            if (line.length < MAX_CHARS) {
                _addToSplitList(line, splitList);
                break;
            }
            var phrase = _getNextPhrase(line);
            line = line.substring(phrase.length);
            _addToSplitList(phrase, splitList);
        }
    }

    function _getNextPhrase(text) {
        return text;
        var pos = line.search(/[\:\!\?\.\;]+/); // P1
        if (pos >= 0) return text.substring(0, pos+1);
        pos = line.search(/[\,]+/); // P2
        if (pos >= 0) return text.substring(0, pos+1);
        pos = line.search(/[ ]+/); // P3
        if (pos >= 0) return text.substring(0, pos+1);
        return text.substring(0, MAX_CHARS); // P4
    }
    
    function _addToSplitList(text, splitList) {
        if (text == '') return;
        var pos = text.indexOf('@voice(');
        if (pos < 0) {
            _addToSplitList2(text, splitList);
            return;
        }
        var preText = text.substring(0, pos);
        _addToSplitList2(preText, splitList);
        var rest = text.substring(pos+7);
        var pos2 = rest.indexOf(')');
        var voiceConfigStr = (pos2 < 0) ? rest : rest.substring(0, pos2);
        rest = (pos2 < 0) ? '' : rest.substring(pos2+1);
        _updateVoiceConfig(voiceConfigStr);
        _addToSplitList(rest, splitList);
    }

    function _addToSplitList2(text, splitList) {
        if (text.length == 0) return;
        splitList.push({text: text, 
            voice: config.voice, lang: config.lang, 
            volume: config.volume, rate: config.rate, pitch: config.pitch});
    }

    function _updateVoiceConfig(voiceConfigStr) {
        var params = voiceConfigStr.split(',');
        var voice = [];
        for (var i=0; i<params.length; i++) {
            var param = params[i];
            var avp = param.split('=');
            if (avp.length != 2) {
                voice.push(avp[0]);
                continue;
            }
            _checkAndUpdateStr(avp, 'lang');
            _checkAndUpdateFloat(avp, 'volume', 0, 1);
            _checkAndUpdateFloat(avp, 'rate', 0.1, 10);
            _checkAndUpdateFloat(avp, 'pitch', 0, 2);
        }
        if (voice.length > 0) config.voice = voice;
    }

    function _checkAndUpdateStr(avp, aName) {
        if (avp[0] != aName) return;
        config[aName] = avp[1];
    }

    function _checkAndUpdateFloat(avp, aName, min, max) {
        if (avp[0] != aName) return;
        var val = parseFloat(avp[1]);
        if (val < min) val = min;
        if (val > max) val = max;
        config[aName] = val;
    }
}

//#############################################################################################
function Voices() {
    var self = this;
    var _voices = null;
    
    this.getBestFitSystemVoice = function(search, lang) {
        var _suitedVoices = [];
        for (var i=0; i<_voices.length; i++) {
            var v = _voices[i];
            var score = 0;
            if (_found(v.lang, lang)) {
                score += 3;
            }
            for(var j=0; j<search.length; j++) {
                if (_found(v.name, search[j])) score += 2;
            }
            if (v.localService) score += 1;
            if (score > 0) _suitedVoices.push({obj: v, score: score});
        }
        if (_suitedVoices.length == 0) return null;
        _suitedVoices.sort(function(a, b) {
            return (b.score - a.score);
        });
        return _suitedVoices[0].obj;
    };
    
    function _found(str, substr) {
        str =str.toLowerCase();
        substr = substr.toLowerCase();
        return (str.indexOf(substr) >= 0);
    }
    
    function _init() {
        // Wait until system voices are ready
        window.speechSynthesis.onvoiceschanged = function () {
            _initVoices();
        };
        
        // The event onvoiceschanged does not seem come in all
        // systems. So also do a multiple trial method. 
        // Which ever works - works.
        _initVoicesInTimeouts(100, 100);
    }

    function _gotVoices() {
        return _voices && _voices.length;
    }
    
    function _initVoices() {
        if (_gotVoices()) return;
        _voices = window.speechSynthesis.getVoices();
        if (_gotVoices()) {
            console.log('Voices supported by the system:', _voices);
        }
    }

    function _initVoicesInTimeouts(timeout, pendingAttempts) {
        if (pendingAttempts < 0) {
            console.warn('Failed to initialize system voices after multiple attempts');
            // On IOS, this could sometimes be empty but speach still works. 
            // So no need to break operations even if voices are empty.
            return;
        }
        var nextTimeout = timeout < 1000 ? 2*timeout : 2000;
        window.setTimeout(function() {
            _initVoices();
            if (!_gotVoices()) _initVoicesInTimeouts(nextTimeout, pendingAttempts-1);
        }, timeout);
    }
    
    _init();
}

//#############################################################################################
function AudioManager() {
    var self = this;
    
    this.getButton = function(audioUrl, pageId) {
        _init();
        var button = _getVoiceButtonDom();
        var info = _addPageAudio(audioUrl, pageId, button);
        button.on('click', function () {
            _onButtonClick(info, audioUrl, pageId, button);
        });
        return button;
    };
    
    var _currentInfo = null;
    this.play = function(pageId) {
        this.pauseAll();
        var info = _audioHolder ? _audioHolder[pageId] : null;
        if (!info) return;
        _currentInfo = info;
        if (!_currentInfo.canplay) {
            info.playing = false;
            info.audio.load();
            return;
        }
        if (!_canAutoPlay) return;
        _currentInfo.audio.play();
    };

    this.pauseAll = function() {
        if (!_currentInfo || !_currentInfo.playing) return;
        _currentInfo.audio.pause();
        _currentInfo = null;
    };
    
    var _audioHolder = null;
    function _init(bForce) {
        if (_audioHolder && !bForce) return;
        _audioHolder = {};
        var holder = jQuery('#audioHolder');
        holder.html('');
    }
    
    function _addPageAudio(audioUrl, pageId, button) {
        var holder = jQuery('#audioHolder');
        var info = null;
        if (pageId in _audioHolder) {
            info = _audioHolder[pageId];
            info.button = button;
            info.url = audioUrl;
            info.canplay = false;
            info.playing = false;
            info.audio.src = audioUrl;
            info.audio.load();
        } else {
            var audio = jQuery(njs_helper.fmt2('<audio src="{}"/>', audioUrl));
            info = {audio: audio[0], url: audioUrl, button: button, pageId: pageId,
                canplay: false, playing: false};
            _audioHolder[pageId] = info;
            _registerAudioEvents(info);
            holder.append(audio);
        }
        _updateIcon(info);
        return info;
    }
    
    function _registerAudioEvents(info) {
        var audio = info.audio;
        var pageId = info.pageId;
        audio.addEventListener('canplay', function() {
            _debug(pageId, 'Audio is loaded');
            info.canplay = true;
            if (_currentInfo && _currentInfo.pageId == pageId && _canAutoPlay)
                self.play(pageId);
            _updateIcon(info);
        }, true);
        audio.addEventListener('pause', function() {
            _debug(pageId, 'Audio is paused');
            info.playing = false;
            _updateIcon(info);
        }, true);
        audio.addEventListener('play', function() {
            _debug(pageId, 'Audio is played');
            info.playing = true;
            _updateIcon(info);
        }, true);
        audio.addEventListener('ended', function() {
            _debug(pageId, 'Audio play done');
            info.playing = false;
            _updateIcon(info);
        }, true);
    }
    
    function _debug(pageId, msg) {
        msg = pageId + ': ' + msg;
        //console.log(msg);
    }

    function _updateIcon(info) {
        var prefix = nittio.getStaticResFolder();
        if (!info.canplay) {
            _setVoiceButtonIcon(info.button, 'buffering.icon');
        } else if (!info.playing) {
            _setVoiceButtonIcon(info.button, 'play.icon');
        } else {
            _setVoiceButtonIcon(info.button, 'pause.icon');
        }
    }
    
    function _onButtonClick(info, audioUrl, pageId, button) {
        _currentInfo = info;
        if (!info.canplay) {
            njs_helper.Dialog.popupStatus('Audio is loading. Please wait ...');
            _addPageAudio(audioUrl, pageId, button); // Needed for mobile
        } else if (info.playing) {
            _debug(info.pageId, 'Pause called');
            _canAutoPlay = false;
            info.audio.pause();
        } else {
            _debug(info.pageId, 'Play called');
            _canAutoPlay = true;
            info.audio.play();
        }
        _updateIcon(info);
    }
}

return {getAutoVoice: getAutoVoice, getAudioManager: getAudioManager};

}(); 
