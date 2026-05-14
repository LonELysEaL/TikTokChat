// This will use the demo backend if you open index.html locally via file://, otherwise your server will be used
//let backendUrl = location.protocol === 'file:' ? "https://tiktok-chat-reader.zerody.one/" : undefined;

let ConnectionState = {
    IDLE: "IDLE",
    CONNECTING: "CONNECTING",
    CONNECTED: "CONNECTED",
    RECONNECTING: "RECONNECTING",
    FAILED: "FAILED"
};

let currentState = ConnectionState.IDLE;
let lastEventTime = Date.now();

let connectTimer = null;
let reconnectTimer = null;

function setState(state, message = "") {
    currentState = state;

    console.log("STATE =>", state, message);

    switch (state) {

        case ConnectionState.CONNECTING:
            $('#stateText').text("Connecting...");
            document.getElementById('connectButton').disabled = true;
            break;

        case ConnectionState.CONNECTED:
            $('#stateText').text(message || "Connected");
            document.getElementById('connectButton').disabled = false;
            break;

        case ConnectionState.RECONNECTING:
            $('#stateText').text("Reconnecting...");
            document.getElementById('connectButton').disabled = true;
            break;

        case ConnectionState.FAILED:
            $('#stateText').text(message || "Connection Failed");
            document.getElementById('connectButton').disabled = false;
            break;

        case ConnectionState.IDLE:
        default:
            $('#stateText').text("");
            document.getElementById('connectButton').disabled = false;
            break;
    }
}

let backendUrl = location.protocol === 'file:' ? "https://tiktokchat-production.up.railway.app" : undefined;
let connection = new TikTokIOConnection(backendUrl);

let isConnected = false;

// Counter
let viewerCount = 0;
let likeCount = 0;
let diamondsCount = 0;

let giftFloat = true;
let giftComment = false;

// These settings are defined by obs.html
if (!window.settings) window.settings = {};

$(document).ready(() => {
    $('#connectButton').click(connect);
    $('#uniqueIdInput').on('keyup', function (e) {
		if (document.getElementById('connectButton').disabled == false) {
			if (e.key === 'Enter') {
				connect();
			}
		}
    });
	
    $('#answerInput').on('keyup', function (e) {
        if (e.key === 'Enter') {
            setAnswer();
        }
    });

    if (window.settings.username) connect();
})

function connect() {

    let uniqueId = window.settings.username || $('#uniqueIdInput').val();

    if (!uniqueId) {
        alert("No username entered");
        return;
    }

    if (currentState === ConnectionState.CONNECTED &&
        document.title.slice(9) === uniqueId) {
        alert("Already connected");
        return;
    }

    setState(ConnectionState.CONNECTING);

    // clear old timers
    if (connectTimer) clearTimeout(connectTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);

    connection.connect(uniqueId, {
        enableExtendedGiftInfo: true
    }).then(state => {

        setState(ConnectionState.CONNECTED, `Room ${state.roomId}`);

        isConnected = true;

        viewerCount = 0;
        likeCount = 0;
        diamondsCount = 0;
        updateRoomStats();

        document.title = "TikTok - " + uniqueId;

        // cancel timeout
        if (connectTimer) clearTimeout(connectTimer);

    }).catch(err => {

        console.error("CONNECT ERROR:", err);

        setState(ConnectionState.FAILED, err?.toString?.() || "Failed");

        scheduleReconnect(uniqueId);

    });

    // ⛔ timeout guard (controlled by state machine)
    connectTimer = setTimeout(() => {

        if (currentState !== ConnectionState.CONNECTED) {
            setState(ConnectionState.FAILED, "Connection Timeout");

            scheduleReconnect(uniqueId);
        }

    }, 15000);
}

function scheduleReconnect(uniqueId) {

    if (currentState === ConnectionState.CONNECTED) return;

    setState(ConnectionState.RECONNECTING);

    let delay = 3000;

    reconnectTimer = setTimeout(() => {

        console.log("🔁 Reconnecting...");

        connection.connect(uniqueId, {
            enableExtendedGiftInfo: true
        }).then(state => {

            setState(ConnectionState.CONNECTED, `Room ${state.roomId}`);
            isConnected = true;

        }).catch(err => {

            console.error("RECONNECT FAIL:", err);

            setState(ConnectionState.FAILED, "Reconnect failed");

            scheduleReconnect(uniqueId); // retry loop

        });

    }, delay);
}

// Prevent Cross site scripting (XSS)
function sanitize(text) {
    return text.replace(/</g, '&lt;')
}

function matchSearchRule(str,wildcard) {
  let w = wildcard.replace(/[.+^${}()|[\]\\]/g, '\\$&'); // regexp escape 
  const re = new RegExp(`^${w.replace(/\*/g,'.*').replace(/\?/g,'.')}$`,'i'); // remove last 'i' to have case sensitive
  return re.test(str); 
}

function updateRoomStats() {
    $('#roomStats').html(`Viewers: <b>${viewerCount.toLocaleString()}</b> Likes: <b>${likeCount.toLocaleString()}</b> Earned Coins: <b>${diamondsCount.toLocaleString()}</b>`)
}

function generateUsernameLink(data, color) {
//    return `<a class="usernamelink" href="https://www.tiktok.com/@${data.uniqueId}" target="_blank">${data.uniqueId}</a>`;

    if (data.isModerator) {
	color = '#BB4444';
    } else if (data.isSubscriber) {
	color = '#CCDD44';
    } else if (color == '') {
 	color = '#449944';  // *** Default Color ***
    }

    return `<a class="usernamelink" href="https://www.tiktok.com/@${data.uniqueId}" target="_blank" style="color:${color};" title="${data.uniqueId}">${data.nickname}</a>`;
}

function generateUsernameBadge(data) {
	
	let gifterBadgeUrl , gifterBadgeColor;
	switch(true) {
	case (data.gifterLevel < 5) :
		gifterBadgeUrl = 'https://p16-webcast.tiktokcdn.com/webcast-va/grade_badge_icon_lite_lv1_v1.png~tplv-obj.image';
		gifterBadgeColor = 'style="background-color: rgba(120, 158, 231, 0.6);';
		break;
	case (data.gifterLevel < 10) :
		gifterBadgeUrl = 'https://p16-webcast.tiktokcdn.com/webcast-va/grade_badge_icon_lite_lv5_v1.png~tplv-obj.image';
		gifterBadgeColor = 'style="background-color: rgba(95, 144, 239, 0.6);';
		break;
	case (data.gifterLevel < 15) :
		gifterBadgeUrl = 'https://p16-webcast.tiktokcdn.com/webcast-va/grade_badge_icon_lite_lv10_v1.png~tplv-obj.image';
		gifterBadgeColor = 'style="background-color: rgba(63, 125, 246, 0.6);';
		break;
	case (data.gifterLevel < 20) :
		gifterBadgeUrl = 'https://p16-webcast.tiktokcdn.com/webcast-va/grade_badge_icon_lite_lv15_v2.png~tplv-obj.image';
		gifterBadgeColor = 'style="background-color: rgba(71, 126, 255, 0.7);';
		break;
	case (data.gifterLevel < 25) :
		gifterBadgeUrl = 'https://p16-webcast.tiktokcdn.com/webcast-va/grade_badge_icon_lite_lv20_v1.png~tplv-obj.image';
		gifterBadgeColor = 'style="background-color: rgba(71, 90, 255, 0.7);';
		break;
	case (data.gifterLevel < 30) :
		gifterBadgeUrl = 'https://p16-webcast.tiktokcdn.com/webcast-va/grade_badge_icon_lite_lv25_v1.png~tplv-obj.image';
		gifterBadgeColor = 'style="background-color: rgba(39, 47, 243, 0.7);';
		break;
	case (data.gifterLevel < 35) :
		gifterBadgeUrl = 'https://p16-webcast.tiktokcdn.com/webcast-va/grade_badge_icon_lite_lv30_v1.png~tplv-obj.image';
		gifterBadgeColor = 'style="background-color: rgba(42, 25, 238, 0.75);';
		break;
	case (data.gifterLevel < 40) :
		gifterBadgeUrl = 'https://p16-webcast.tiktokcdn.com/webcast-va/grade_badge_icon_lite_lv35_v3.png~tplv-obj.image';
		gifterBadgeColor = 'style="background-color: rgba(64, 7, 228, 0.75);';
		break;
	case (data.gifterLevel < 45) :
		gifterBadgeUrl = 'https://p16-webcast.tiktokcdn.com/webcast-va/grade_badge_icon_lite_lv40_v2.png~tplv-obj.image';
		gifterBadgeColor = 'style="background-color: rgba(104, 7, 228, 0.75);border: 0.5px solid;';
		break;
	case (data.gifterLevel < 50) :
		gifterBadgeUrl = 'https://p16-webcast.tiktokcdn.com/webcast-va/grade_badge_icon_lite_lv45_v1.png~tplv-obj.image';
		gifterBadgeColor = 'style="background-color: rgba(104, 7, 228, 0.8); border: 0.5px solid;';
		break;
    default:
		gifterBadgeUrl = 'https://p16-webcast.tiktokcdn.com/webcast-va/grade_badge_icon_lite_lv50_v1.png~tplv-obj.image';
		gifterBadgeColor = 'style="background-color: rgba(104, 7, 228, 0.9);border: 0.5px solid;';
		break;
    }
	gifterBadgeColor += 'padding: 1px 1px 1px 0px;display: inline-flex;overflow: hidden;border-radius: 4px;margin-inline-end: 4px;"';
	
	let teamBadgeUrl , teamBadgeColor, teamBadgeLabel;
	switch(true) {
	case (data.teamMemberLevel < 10) :
		teamBadgeUrl = 'https://p16-webcast.tiktokcdn.com/webcast-va/fans_badge_icon_lv1_v0.png~tplv-obj.image';
		teamBadgeColor = 'style="background-color: rgba(215, 78, 54, 0.6);';
		teamBadgeLabel = 'I';
		break;
	case (data.teamMemberLevel < 20) :
		teamBadgeUrl = 'https://p16-webcast.tiktokcdn.com/webcast-va/fans_badge_icon_lv10_v0.png~tplv-obj.image';
		teamBadgeColor = 'style="background-color: rgba(215, 81, 57, 0.65);';
		teamBadgeLabel = 'II';
		break;
	case (data.teamMemberLevel < 30) :
		teamBadgeUrl = 'https://p16-webcast.tiktokcdn.com/webcast-va/fans_badge_icon_lv20_v0.png~tplv-obj.image';
		teamBadgeColor = 'style="background-color: rgba(214, 61, 53, 0.7);';
		teamBadgeLabel = 'III';
		break;
	case (data.teamMemberLevel < 40) :
		teamBadgeUrl = 'https://p16-webcast.tiktokcdn.com/webcast-va/fans_badge_icon_lv30_v0.png~tplv-obj.image';
		teamBadgeColor = 'style="background-color: rgba(214, 62, 54, 0.75);';
		teamBadgeLabel = 'IV';
		break;
	case (data.teamMemberLevel < 50) :
		teamBadgeUrl = 'https://p16-webcast.tiktokcdn.com/webcast-va/fans_badge_icon_lv40_v0.png~tplv-obj.image';
		teamBadgeColor = 'style="background-color: rgba(214, 62, 54, 0.85);border: 0.5px solid;';
		teamBadgeLabel = 'V';
		break;
    default:
		teamBadgeUrl = 'https://p16-webcast.tiktokcdn.com/webcast-va/fans_badge_icon_lv50_v0.png~tplv-obj.image';
		teamBadgeColor = 'style="background-color: rgba(214, 62, 54, 0.85);border: 0.5px solid;';
		teamBadgeLabel = 'VI';
		break;
    }
	teamBadgeColor += 'padding: 1px 1px 1px 0px;display: inline-flex;overflow: hidden;border-radius: 4px;margin-inline-end: 4px;"';

//    return `<a class="usernamelink" href="https://www.tiktok.com/@${data.uniqueId}" target="_blank" style="color:${color};" title="${data.uniqueId}">${data.nickname}</a>`;
	let dummy = '<span style="font-family: ' + "'times new roman'" + ' , times, serif;font-size:80%;margin: auto">';
	if (data.gifterLevel > 0) {
		dummy += '<span ' + gifterBadgeColor + '>&nbsp;<img src="' + gifterBadgeUrl + '" style="width:20px;height:20px;align-items: center;margin-inline-end: 4px;margin: auto;">' + data.gifterLevel + '&nbsp;</span>';
	}
	if (data.teamMemberLevel > 0 ) {
		dummy += '<span ' + teamBadgeColor + ' title="' + data.teamMemberLevel + '">&nbsp;<img src="' + teamBadgeUrl + '" style="width:20px;height:20px;align-items: center;margin-inline-end: 4px;margin: auto;"> ' + teamBadgeLabel + '&nbsp;</span>' + '</span>';
	}
	dummy +=  '</span>';
    return dummy;
}

function isPendingStreak(data) {
    return data.giftType === 1 && !data.repeatEnd;
}

function getTime(param1) {
	if (typeof(param1) == "number") {
    	theTime = param1;
	} else if (typeof(param1) == "string") {
    	theTime = Number(param1);
    } else {
    	theTime = 0;
    }
	let currDate = new Date();

	if ((Number(theTime) > 0 ) ) {
		currDate = new Date(theTime);
	} else {
		currDate = new Date();
	}

    let currHour = currDate.getHours();
    let currMin = currDate.getMinutes();
    let currSec = currDate.getSeconds();
    let currMSec = currDate.getMilliseconds();
	
    return ((currHour<10)?"0":"") + currHour + ":" + ((currMin<10)?"0":"") + currMin + ":" + ((currSec<10)?"0":"") + currSec + "." + ((currMSec<10)?"00":((currMSec<100)?"0":"")) + currMSec;
}

/**
 * Add a new message to the chat container
 */
function addChatItem(color, data, text, summarize) {
    let timeStamp = getTime(data.createTime);
    let container = location.href.includes('obs.html') ? $('.eventcontainer') : $('.chatcontainer');

    if (container.find('div').length > 500) {
        container.find('div').slice(0, 200).remove();
    }

    container.find('.temporary').remove();
	
    let isScrolledToBottom = container[0].scrollHeight - container[0].clientHeight <= container[0].scrollTop + 1;
	
	let displayText = combineComment(data.comment,data.emotes);

    container.append(`
        <div class=${summarize ? 'temporary' : 'static'} id="${data.createTime}">&nbsp;&nbsp;
            <img class="miniprofilepicture" src="${data.profilePictureUrl}">
            <span style="align-items: center;">
                <b>${generateUsernameLink(data, '')}</b> ${generateUsernameBadge(data)} <b>:</b> 
                <span style="color:${color}" title="${timeStamp}">${displayText}</span>
				<b></b>
            </span>
        </div>
    `);
	
	const button = document.getElementById(data.createTime);
	let timer
	button.addEventListener('click', event => {
		if (event.detail === 1) {
			timer = setTimeout(() => {
				selectElement(event)
			}, 200)
		}
	})
	button.addEventListener('dblclick', event => {
		clearTimeout(timer)
		moveNoteItem(event)
	})
	
    container.stop();
	if (isScrolledToBottom) {
		container[0].scrollTop = container[0].scrollHeight - container[0].clientHeight;
	}
	
	if (text.slice(-5) == '!note') {
		if (data.isModerator) {
			let cmdEvent = new MouseEvent('dblclick', {
				'view': window,
				'bubbles': true,
				'cancelable': true
			});
			let noteMove = document.getElementById(data.createTime);
			noteMove.dispatchEvent(cmdEvent);
		}
	}
//	addRawItem('',data,'chat');
}

function addRawItem(color, data, text, summarize) {
    let container = location.href.includes('obs.html') ? $('.eventcontainer') : $('.rawcontainer');
	
    let isScrolledToBottom = container[0].scrollHeight - container[0].clientHeight <= container[0].scrollTop + 1;
	let strData = JSON.stringify(data);
	
    container.append(`
        <div class='static'}>&nbsp;&nbsp;
			<span style="color:"${color}">[${text}]:${strData}</span>
        </div>
    `);

    container.stop();
	if (isScrolledToBottom) {
		container[0].scrollTop = container[0].scrollHeight - container[0].clientHeight;
	}
}

function addTreasure(data) {
	let currTime = new Date();
	let timeStamp = getTime(data.timestamp * 1000);
	
	let dummy = { "createTime" : currTime , "profilePictureUrl" : data.profilePictureUrl , "uniqueId" : data.uniqueId , "nickname" : data.nickname , "isModerator" : data.isModerator , "isSubscriber" : data.isSubscriber }
	if (dummy.uniqueId != undefined) {
		addEventItem('Yellow' , dummy , "🎁 " + data.coins + " 💰 for " + data.canOpen + " 🙋");
	}
}

/**
 * Add a new message to the chat container
 */
function addEventItem(color, data, text, summarize) {
    let timeStamp = getTime(data.createTime);
    let container = location.href.includes('obs.html') ? $('.eventcontainer') : $('.roomeventcontainer');

    if (container.find('div').length > 500) {
        container.find('div').slice(0, 200).remove();
    }

    if (summarize) {
      container.find('.temporary').remove();
    } else {
    }
	
    let isScrolledToBottom = container[0].scrollHeight - container[0].clientHeight <= container[0].scrollTop + 1;

    let eventText = sanitize(text).replace(' liked the LIVE','❤️'); //👍
    eventText = eventText.replace('shared the LIVE','📬'); //✉️
    eventText = eventText.replace('followed the LIVE creator','📌'); // 🥇🥈🥉 🚪
    let eventTitle = '';
    if (eventText.indexOf('❤️') >= 0) {
		eventTitle = 'Likes';
    } else if (eventText.indexOf('📬') >= 0) {
		eventTitle = 'Shares';
    } else if (eventText.indexOf('📌') >= 0) {
		eventTitle = 'Follows';
    }

	if (summarize) {
		clearInterval(eventTempBlinkInterval);
	} else {
		clearInterval(eventStaticBlinkInterval);
	}

	container.append(`
        <div class=${summarize ? 'temporary' : 'static'} id='lastEvent${summarize ? 'temp' : 'static'}' style="background-color: #191919">&nbsp;&nbsp;
            <img class="miniprofilepicture" src="${data.profilePictureUrl}" title="${eventTitle}">
            <span title="${timeStamp}">
<!--                <b style="background-color:${color=='#21b2c2'?'yellow">&nbsp;' : '">'}${generateUsernameLink(data,'')}${color=='#21b2c2'?'&nbsp;':''}</b>: -->
                <b style="background-color:${color=='#21b2c2'?'yellow">&nbsp;' : '">'}${generateUsernameLink(data,'')} </b>
                ${color=='#21b2c2'?'&nbsp;' + generateUsernameBadge(data) + '&nbsp;: 🚪':' : <span style="color:${color};">' + eventText + '</span>'}
            </span>
        </div>
    `);
	
	if (summarize) {
		eventTempBlinkInterval = setInterval(setTempEventBlink,250);
	} else {
//		container.append(clone);
		eventStaticBlinkInterval = setInterval(setStaticEventBlink,250);
	}

	container.stop();
	if (isScrolledToBottom) {
		container[0].scrollTop = container[0].scrollHeight - container[0].clientHeight;
	}
}	

//eventBlinkInterval = setInterval(setEventBlink,200);
var eventTempBlinkInterval;
var eventStaticBlinkInterval;

/*
function setEventBlink(){
	let container = document.getElementById('lastEvent');
	if (container.length > 0) {
		for (let i=0 ; i < container.length ; i++){
			container[i].style.backgroundColor = "transparent";
			container[i].id = '0';
		}
//	} else if (container.length == 1) {
	} else {
		container.style.backgroundColor = "transparent";
		container.id = '0';
	}
	//container.bgColor = "transparent";
	clearInterval(eventBlinkInterval);
//	alert(container.style.backgroundColor);
}
*/

function setTempEventBlink(){
	let container = document.getElementById('lastEventtemp');
	if (container != null) {
		if (container.length > 0) {
			for (let i=0 ; i < container.length ; i++){
				container[i].style.backgroundColor = "transparent";
				container[i].id = '0';
			}
	//	} else if (container.length == 1) {
		} else {
			container.style.backgroundColor = "transparent";
			container.id = '0';
		}
	} else {
		//container.bgColor = "transparent";
		clearInterval(eventTempBlinkInterval);
//	alert(container.style.backgroundColor);
	}
}

function setStaticEventBlink(){
	let container = document.getElementById('lastEventstatic');
	if (container != null) {
		if (container.length > 0) {
			for (let i=0 ; i < container.length ; i++){
				container[i].style.backgroundColor = "transparent";
				container[i].id = '0';
			}
	//	} else if (container.length == 1) {
		} else {
			container.style.backgroundColor = "transparent";
			container.id = '0';
		}
	} else {
		//container.bgColor = "transparent";
		clearInterval(eventStaticBlinkInterval);
//	alert(container.style.backgroundColor);
	}
}

/**
 * Add a new gift to the gift container
 */
function addGiftItem(data) {
	
    // ****** Add floating Gift ****
    if (giftFloat) {
	if (isPendingStreak(data) || (data.giftType !== 1)) {
		addFloatGift(data);
	}
    }
		
    let timeStamp = getTime(data.createTime);
    let container = location.href.includes('obs.html') ? $('.eventcontainer') : $('.giftcontainer');

    if (container.find('div').length > 200) {
        container.find('div').slice(0, 100).remove();
    }

    let streakId = data.userId.toString() + '_' + data.giftId;
	
    let isScrolledToBottom = container[0].scrollHeight - container[0].clientHeight <= container[0].scrollTop + 1;

    let totalCoin = data.diamondCount * data.repeatCount;
    let totalColor;
    switch(true) {
	case (totalCoin < 100) :
		totalColor = "#AAAAAA";
		break;
	case (totalCoin < 500) :
		totalColor = "#057DFF"; // rgb(103,126,130)
		break;
	case (totalCoin < 1000) :
		totalColor = "#D400FF"; // rgb(29,120,116)
		break;
	case (totalCoin < 5000) :
		totalColor = "#00FFE1"; // rgb(123,166,157)
		break;
	case (totalCoin < 10000) :
		totalColor = "#00FF2E"; // rgb(204,152,109)
		break;
	case (totalCoin < 20000) :
		totalColor = "#D8FF00"; // rgb(192,0,3)
		break;
	case (totalCoin < 30000) :
		totalColor = "#FFCC00"; // rgb(255,0,0)
		break;
    default:
		totalColor = "#FF1900"; // rgb(255,255,0)
		break;
    }

    let html = `
        <div class="static" id="${data.createTime}" data-streakid="${isPendingStreak(data) ? streakId : ''}">&nbsp;&nbsp;
            <img class="miniprofilepicture" src="${data.profilePictureUrl}">
            <span>
                <b>${generateUsernameLink(data,'')}</b> ${generateUsernameBadge(data)} <b> : </b><!-- <span>${data.describe}</span>--><br>
                <div>
                    <table>
                        <tr>
							<td>&nbsp;&nbsp;&nbsp;&nbsp;</td>
                            <td><img class="gifticon" src="${data.giftPictureUrl}" title="${timeStamp}"></td>
                            <td>
                                <span>Name: <b>${data.giftName}</b> (ID:${data.giftId})<span><br>
                                <span>Repeat: <b style="${isPendingStreak(data) ? 'color:red' : ''}">x${data.repeatCount.toLocaleString()}</b><span><br>
                                <span>Cost: <b style="color:${totalColor}">${totalCoin.toLocaleString()}</b><b> Coins</b><span>
                            </td>
                        </tr>
                    </tabl>
                </div>
            </span>
        </div>
    `;

//                                <span>Cost: <b>${(data.diamondCount * data.repeatCount).toLocaleString()} Diamonds</b><span>

    let existingStreakItem = container.find(`[data-streakid='${streakId}']`);

    if (existingStreakItem.length) {
        existingStreakItem.replaceWith(html);
    } else {
        container.append(html);
	
		// ****** Add gift in comment ****
	if (giftComment) {
		let chatAlert = { "createTime" : data.createTime , "comment" : " sent " + data.giftName , "emotes" : [{ "placeInComment" : 5 , "emoteImageUrl" : data.giftPictureUrl }] , "profilePictureUrl" : data.profilePictureUrl , "uniqueId" : data.uniqueId , "nickname" : data.nickname }
		addChatItem(totalColor + " ; opacity : 0.5;",chatAlert);
	}
    }

	const button = document.getElementById(data.createTime);
	let timer
	button.addEventListener('click', event => {
		if (event.detail === 1) {
			timer = setTimeout(() => {
				selectElement(event)
			}, 200)
		}
	})
/*
	button.addEventListener('dblclick', event => {
		//clearTimeout(timer)
		//moveNoteItem(event)
	})
*/

    container.stop();
	if (isScrolledToBottom) {
		container[0].scrollTop = container[0].scrollHeight - container[0].clientHeight;
	}
}

function getOffset(el) {
  const rect = el.getBoundingClientRect();
  return {
    left: rect.left + window.scrollX,
    top: rect.top + window.scrollY,
    width: rect.width,
    height: rect.height
  };
}

var WindowsSize=function(){
	var currH=$(window).height(),currW=$(window).width();
	var table1 = document.getElementById("table1");
	var chat1 = document.getElementById("chatcontainer1");
	var gift1 = document.getElementById("giftcontainer1");
	var event1 = document.getElementById("roomeventcontainer1");
	var note1 = document.getElementById("notecontainer1");
	var answerBox = document.getElementById("answerBoxArea");
	var posTable = getOffset(table1);
	var posTableNote = getOffset(document.getElementById("tbNote"));

	document.getElementById("btnSetting1").style.top = "10px";
	document.getElementById("btnSetting1").style.left = (currW - 30 ) + "px";
	document.getElementById("btnSettingAnswer").style.top = posTableNote.top + 5 + "px";
	document.getElementById("btnSettingAnswer").style.left = (posTableNote.left + posTableNote.width - 30 ) + "px";
	chat1.style.height = ((currH - posTable.top) - 80) + "px";
	gift1.style.height = ((currH - posTable.top) - 80) + "px";
	event1.style.height = ((currH - posTable.top)/2 - 80) + "px";
	note1.style.height = ((currH - posTable.top)/2 - 80)  + "px";
	var posNote = getOffset(note1);
/*
	var posChat = getOffset(chat1);
	var posGift = getOffset(gift1);
	var posGift = getOffset(gift1);
	var posEvent = getOffset(event1);
*/
/*
	answerBox.style.top = posNote.top + "px";
	answerBox.style.left = posNote.left + "px";
	answerBox.style.width = (posNote.width - 6) + "px";
	answerBox.style.height = posNote.height + "px";
*/
	posTableNote = getOffset(document.getElementById("tbNote"));
	answerBox.style.top = (posTableNote.top + 4) + "px";
	answerBox.style.left = (posTableNote.left + 4) + "px";
	answerBox.style.width = (posTableNote.width - 14) + "px";
	answerBox.style.height = (posTableNote.height - 14) + "px";

	let posAnswerBox = getOffset(answerBox);
	let answerContainer = document.getElementById("answerBoxContainer");
	let posAnswerContainer = getOffset(answerContainer);
//	answerContainer.style.height = ((currH - posTable.top)/2 - 160) + "px";
	answerContainer.style.height = (posTableNote.height - 110) + "px";


	const giftContainer = document.getElementById("tbGift");
	let balloonContainer1 = document.getElementById("balloon-container");
//	if (balloonContainer1 == null) {
//		document.body.innerHTML += `<DIV id="balloon-container" style="top:${getOffset(giftContainer).top}px;left:${getOffset(giftContainer).left}px;width:${getOffset(giftContainer).width}px;height:${getOffset(giftContainer).height}px;z-index:-1"></DIV>`;
//		balloonContainer1 = document.getElementById("balloon-container");
//	} else {
		balloonContainer1.style.top = getOffset(giftContainer).top + "px";
		balloonContainer1.style.left = getOffset(giftContainer).left + "px";
		balloonContainer1.style.width = getOffset(giftContainer).width + "px";
		balloonContainer1.style.height = getOffset(giftContainer).height + "px";
		balloonContainer1.style.zIndex = "-1";
//	}

};

$(document).ready(WindowsSize);
$(window).resize(WindowsSize);

headBlinkInterval = setInterval(setHeadBlink,1000);
		
function setHeadBlink() {
	let container = document.getElementById("notecontainer1");
	let numNote = container.childElementCount;
	if (numNote > 0) {
		document.getElementById('NoteHead').innerHTML = "Note(" + numNote + ")";
	} else {
		document.getElementById('NoteHead').innerHTML = "Note";
	}
	document.getElementById('tbNote').bgColor = "transparent";
	clearInterval(headBlinkInterval);
}		

function moveNoteItem(event) {
	let clName = event.target.className;
	if ((clName == "static") || (clName == "temporary")) {
		let container = document.getElementById("notecontainer1");
		let eleAdd = 0;
		if (event.target.parentElement.id == "chatcontainer1") {
			if (document.getElementById(event.target.id + "Note") == null) {
				let sourceE = document.getElementById(event.target.id);
				let clone = sourceE.cloneNode(true);
				clone.id = clone.id + "Note";
				clone.style.border = "2px solid black";
				container.append(clone);
				const button = document.getElementById(event.target.id + "Note");
				let timer
				button.addEventListener('click', event => {
					if (event.detail === 1) {
						timer = setTimeout(() => {
							selectElement(event)
						}, 200)
					}
				})
				button.addEventListener('dblclick', event => {
					clearTimeout(timer)
					moveNoteItem(event)
				})
				eleAdd = 1;						
			}
		} else if (event.target.parentElement.id == "notecontainer1") {
			document.getElementById(event.target.id).remove();
			eleAdd = 2;
		}
		let numNote = container.childElementCount;
		document.getElementById('tbNote').bgColor = "#191919";
		clearInterval(headBlinkInterval);
		if (numNote > 0) {
			document.getElementById('NoteHead').innerHTML = "<font color='red'>Note(" + numNote + ")</font>";
		} else {
			document.getElementById('NoteHead').innerHTML = "<font color='red'>Note</font>";
		}
		if (eleAdd == 1) {
			headBlinkInterval = setInterval(setHeadBlink,500);
		} else if (eleAdd == 2) {
			headBlinkInterval = setInterval(setHeadBlink,100);
		} else {
			headBlinkInterval = setInterval(setHeadBlink,1);
		}
	}
}

function combineComment(commentText,emoteData,posInComment) {
	let theNum = 0;
	if (typeof(posInComment) == "number") {
    	theNum = posInComment;
	} else if (typeof(posInComment) == "string") {
    	theNum = Number(posInComment);
    } else {
    	theNum = Number(emoteData.length);
    }    
    if (isNaN(theNum)) {
    	theNum = 0;
    }
    
    if (theNum > 0) {
	const firstPart = [...commentText].slice(0, emoteData[(theNum-1)].placeInComment ).join('');
	const secondPart = [...commentText].slice(emoteData[(theNum-1)].placeInComment ).join('');
//alert("'" + firstPart + "' : '" + secondPart + "'");
	return combineComment(firstPart,emoteData,theNum-1) + "<img class='chatemote' src='" + emoteData[theNum-1].emoteImageUrl  + "'> " + sanitize(secondPart);                   
    } else {
    	return sanitize(commentText);
    }
}

var selectedEle = { chatcontainer1 : 1, giftcontainer1 : 2, notecontainer1 : 3, roomeventcontainer1 : 4 };

function selectElement(event) {
	if (selectedEle[event.target.parentElement.id] != undefined) {
		//alert("Class Name : " + event.target.parentElement.id + "\n / ID : " + event.target.id + "\n / Value : " + selectedEle[event.target.parentElement.id]);
		if (selectedEle[event.target.parentElement.id]  == event.target.id) {
			event.target.style.border = "2px solid black";
			selectedEle[event.target.parentElement.id] = 0;
			//alert(selectedEle[event.target.parentElement.id]  + ":1:" + event.target.id);
		} else {
			if (document.getElementById(selectedEle[event.target.parentElement.id]) != null) {
				document.getElementById(selectedEle[event.target.parentElement.id]).style.border = "2px solid black";
				//alert(selectedEle[event.target.parentElement.id]  + ":2:" + event.target.id);
			} else {
				//alert(selectedEle[event.target.parentElement.id]  + ":3:" + event.target.id);
			}
			event.target.style.border = "2px solid #993919";
			selectedEle[event.target.parentElement.id]  = event.target.id;
			//alert(selectedEle[event.target.parentElement.id]  + ":4:" + event.target.id);
		}
	} else {
//		alert(event.target.length);
	}
}

var theAnswer = "";

function setAnswer() {
	let answerInput = document.getElementById('answerInput').value;
	document.getElementById('answerInput').value = "";
	let answerDisplay = document.getElementById('answer');
	if (answerInput == "") {
		document.getElementById('answer').innerHTML = "";
	} else {
		document.getElementById('answer').innerHTML = (answerInput + " (" + getTime() +")");
	}
	theAnswer = answerInput;
	
	let container = location.href.includes('obs.html') ? $('.eventcontainer') : $('.answercontainer');
	container.find('div').remove();
/*
	if (theAnswer == "") {
		answerModal.style.display = "none";
	}
*/
}

function addCorrectAnswer(data) {
    let timeStamp = getTime(data.createTime);
    let container = location.href.includes('obs.html') ? $('.eventcontainer') : $('.answercontainer');

	if (answerModal.style.display = "none") {
		answerModal.style.display = "block";
	}

    container.append(`
        <div class='answerItem' id="${data.createTime}">&nbsp;&nbsp;
            <img class="miniprofilepicture" src="${data.profilePictureUrl}">
            <span>
                <b>${generateUsernameLink(data, '')}: 
                <span title="${timeStamp}"><font color="red">${data.comment}</font> (${timeStamp})</span>
				</b>
            </span>
        </div>
    `);

    container.stop();
//	addRawItem('',data,'chat');
}

// viewer stats
connection.on('roomUser', (msg) => {
    touchConnection();
    if (typeof msg.viewerCount === 'number') {
        viewerCount = msg.viewerCount;
        updateRoomStats();
    }
})

// like stats
connection.on('like', (msg) => {
    touchConnection();
    if (typeof msg.totalLikeCount === 'number') {
        likeCount = msg.totalLikeCount;
        updateRoomStats();
    }

    if (window.settings.showLikes === "0") return;

    if (typeof msg.likeCount === 'number') {
        addEventItem('#447dd4', msg, msg.label.replace('{0:user}', '').replace('likes', `${msg.likeCount} likes`))
    }
})

// Member join
let joinMsgDelay = 0;
connection.on('member', (msg) => {
    touchConnection();
    if (window.settings.showJoins === "0") return;

    let addDelay = 250;
    if (joinMsgDelay > 500) addDelay = 100;
    if (joinMsgDelay > 1000) addDelay = 0;

    joinMsgDelay += addDelay;

    setTimeout(() => {
        joinMsgDelay -= addDelay;
//        addEventItem('#21b2c2', msg, 'joined', true);
        addEventItem('#21b2c2', msg, 'joined', !((msg.teamMemberLevel > 9) || (msg.gifterLevel > 24)));
    }, joinMsgDelay);
})

// New chat comment received
connection.on('chat', (msg) => {
    touchConnection();
    if (window.settings.showChats === "0") return;

    addChatItem('', msg, msg.comment);
//	if ((msg.comment.trim() == theAnswer.trim()) && (theAnswer != "")) {
//	if ((msg.comment.trim().toUpperCase() == theAnswer.trim().toUpperCase()) && (theAnswer != "")) {
	if (matchSearchRule(msg.comment.trim().toUpperCase() , theAnswer.trim().toUpperCase()) && (theAnswer != "")) {
		addCorrectAnswer(msg);
	}
//	addRawItem('',msg,'chat');
})

// New gift received
connection.on('gift', (data) => {
    touchConnection();
    if (!isPendingStreak(data) && data.diamondCount > 0) {
        diamondsCount += (data.diamondCount * data.repeatCount);
        updateRoomStats();
    }

    if (window.settings.showGifts === "0") return;

    addGiftItem(data);
})

// share, follow
connection.on('social', (data) => {
    touchConnection();
    if (window.settings.showFollows === "0") return;

    let color = data.displayType.includes('follow') ? '#ff005e' : '#2fb816';
    addEventItem(color, data, data.label.replace('{0:user}', ''));
})

connection.on('streamEnd', () => {

    let diff = Date.now() - lastEventTime;

    if (diff < 15000) {
        console.log("IGNORE streamEnd");
        return;
    }

    setState(ConnectionState.RECONNECTING);

    if (window.settings.username) {
        scheduleReconnect(window.settings.username);
    }
});

connection.on('connected', () => {
    touchConnection();
    isConnected = true;
    setState(ConnectionState.CONNECTED);
});

// log raw data
connection.on('subscribe', (data) => {
    touchConnection();
    if (window.settings.showChats === "0") return;

    addRawItem('', data, 'subscribe');
})

connection.on('envelope', (data) => {
    touchConnection();
    if (window.settings.showChats === "0") return;

	addTreasure(data);
//    addRawItem('', data,'envelope');
})

connection.on('emote', (data) => {
    touchConnection();
    if (window.settings.showChats === "0") return;

    addRawItem('', data, 'emote');
})

connection.on('liveIntro', (data) => {
    touchConnection();
    if (window.settings.showChats === "0") return;

    addRawItem('', data, 'liveIntro');
})

connection.on('linkMicArmies', (data) => {
    touchConnection();
    if (window.settings.showChats === "0") return;

    addRawItem('', data, 'linkMicArmies');
})

connection.on('linkMicBattle', (data) => {
    touchConnection();
    if (window.settings.showChats === "0") return;

    addRawItem('', data, 'linkMicArmies');
})

connection.on('questionNew', (data) => {
    touchConnection();
    if (window.settings.showChats === "0") return;

    addRawItem('', data, 'questionNew');
})

connection.on('disconnected', () => {

    let diff = Date.now() - lastEventTime;

    console.log("LAST EVENT DIFF =", diff);

    // ถ้ายังมี event ภายใน 15 วิ
    // ถือว่ายังไม่ตายจริง
    if (diff < 15000) {
        console.log("IGNORE FAKE DISCONNECT");
        return;
    }

    isConnected = false;

    setState(ConnectionState.RECONNECTING);

    if (window.settings.username) {
        scheduleReconnect(window.settings.username);
    }
});

// {###BEGIN###} Floating Gift

function random(num) {
  return Math.floor(Math.random() * num);
}

function getRandomStyles(durationTime) {
  var r = random(255);
  var g = random(255);
  var b = random(255);
  var mt = random(200);
  let maxRegion = getOffset(document.getElementById('tbGift'));
  var ml = 50+random(maxRegion.width-130);

  return `
  background-color: transparent;
  color: rgba(255,255,255,1);
  margin: 0px 0 0 ${ml}px;
  animation: float ${durationTime}s ease-in 1
  `;
}

function createBalloons(num) {
  for (var i = num; i > 0; i--) {
    var balloon = document.createElement("div");
    balloon.id = "floatingGift" + i;
    balloon.className = "balloon";
    let durationFloat = random(5)+5;
    balloon.style.cssText = getRandomStyles(durationFloat);

    balloon.innerHTML = "<BR><BR><BR><BR><BR><center>" + i + "</center>";
    balloon.style.backgroundImage = "url('https://p19-webcast.tiktokcdn.com/img/maliva/webcast-va/d56945782445b0b8c8658ed44f894c7b~tplv-obj.png')";
    balloon.style.backgroundSize = "100%";
    balloonContainer.append(balloon);
    balloon.addEventListener("animationend", removeBalloon);
  }
}

function removeBalloons(noBalloon) {
    if (document.getElementById("floatingGift" + noBalloon) != null) {
      document.getElementById("floatingGift" + noBalloon).remove();
alert(noBalloon);
    }
}

function removeBalloon() {
    if (this.id != null) {
	this.remove();
    }
}

function addFloatGift(dataObject) {
    var balloon = document.createElement("div");
    balloon.id = dataObject.createTime;
    balloon.className = "balloon";	
    let durationFloat = random(3);
	let giftSize = "50%";
	
	switch(true) {
	case (dataObject.diamondCount < 100) :
		durationFloat += 5;
		break;
	case (dataObject.diamondCount < 500) :
		durationFloat += 5;
		break;
	case (dataObject.diamondCount < 1000) :
		durationFloat += 5;
		giftSize = "75%";
		break;
	case (dataObject.diamondCount < 5000) :
		durationFloat += 6;
		giftSize = "75%";
		break;
	case (dataObject.diamondCount < 10000) :
		durationFloat += 6;
		giftSize = "75%";
		break;
	case (dataObject.diamondCount < 20000) :
		durationFloat += 6;
		giftSize = "100%";
		break;
	case (dataObject.diamondCount < 30000) :
		durationFloat += 7;
		giftSize = "100%";
		break;
    default:
		durationFloat += 7;
		giftSize = "100%";
		break;
    }	
	
    balloon.style.cssText = getRandomStyles(durationFloat);
//	balloon.innerHTML = `<div style="display: flex;align-items: center;justify-content: center;><img src="${dataObject.profilePictureUrl}" alt="${dataObject.nickname}" style="width:10%;border-radius:50%"></div>`;
    balloon.style.backgroundImage = "url('" + dataObject.giftPictureUrl + "')";
	balloon.style.backgroundSize = giftSize;
    balloonContainer.append(balloon);
    balloon.addEventListener("animationend", removeBalloon);
}

// {###END###} Floating Gift

function giftOption() {
	if (document.getElementById('giftfloat').checked) {
	    giftFloat = true;
	} else {
	    giftFloat = false;
	}
	if (document.getElementById('giftcomment').checked) {
	    giftComment = true;
	} else {
	    giftComment = false;
	}
}

function touchConnection() {
    lastEventTime = Date.now();

    // ถ้ากำลัง reconnect แต่ยังมี event เข้า
    // แปลว่า connection ยังใช้ได้จริง
    if (currentState === ConnectionState.RECONNECTING) {
        setState(ConnectionState.CONNECTED);
    }
}
