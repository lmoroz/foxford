// ==UserScript==
// @name         Foxford schedule time adjustment
// @namespace    https://github.com/lmoroz/foxford
// @version      0.1
// @author       © Морожникова Лариса, Иркутск, 2021
// @downloadURL  https://raw.githubusercontent.com/lmoroz/foxford/master/foxford.user.js
// @match        https://foxford.ru/dashboard*
// @icon         https://www.google.com/s2/favicons?domain=foxford.ru
// @require      https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js
// @grant        none
// ==/UserScript==

console.log('intercept');

const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const userTimeZoneOffset = (new Date().getTimezoneOffset())/60;
const userLocale = Intl.DateTimeFormat().resolvedOptions().locale;
const arrays = ['course_lessons', 'coach_lessons','events'];

if (!XMLHttpRequest.prototype.getResponseText) {
    XMLHttpRequest.prototype.getResponseText = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText').get;
}
Object.defineProperty(XMLHttpRequest.prototype, 'responseText', {
    get: function() {
        let responseText = XMLHttpRequest.prototype.getResponseText.call(this);
        const req = this;
        if(req.responseURL.match(/api\/calendar/)) {
            const data = JSON.parse(responseText);
            const arraysTotransform = [];
            arrays.forEach(eventType => { if( eventType in data && data[eventType].length > 0) arraysTotransform.push(eventType); });
            if(arraysTotransform.length > 0) {
                arraysTotransform.forEach (eventType => {
                    data[eventType].forEach(e => {
                        if ('starts_at' in e) {
                            //console.log(e.discipline_name || e.title, e.starts_at);
                            const eTimeZoneOffset = e.starts_at.match(/([-+][0-9:]+)$/i)[1];
                            let newStarsAt = moment(e.starts_at).format();
                            const newTimeZoneOffset = newStarsAt.match(/([-+][0-9:]+)$/i)[1];
                            e.starts_at = newStarsAt.replace(newTimeZoneOffset, eTimeZoneOffset);
                            //console.log(e.discipline_name || e.title, eTimeZoneOffset, newTimeZoneOffset, e.starts_at);
                        }
                    });
                });
                responseText = JSON.stringify(data);
                //console.log(responseText);
            }
        };
        return responseText;
    },
    enumerable: true,
    configurable: true
});

function isIntersected (elt) {
    const rect=elt.getBoundingClientRect();
    const x=rect.left;
    const y=rect.top;
    const topElt=document.elementFromPoint(x,y);
    //console.log({elt, topElt, x, y});
    return (topElt && !topElt.isSameNode(elt)) ? topElt.outerHTML.trim() : elt.innerHTML.trim();
}

function reflow(calendarCellElements, calendarTimeElements) {
    let timeCellCounter = -1;
    let rowFilled = '';
    for (let i = 0; i < calendarCellElements.length; i+=7) {
        timeCellCounter++;
        rowFilled = '';
        const cellsToRemove = [];
        for (let c = 0; c < 7; c++) {
            const cellHTML = isIntersected (calendarCellElements[i+c]);
            if (cellHTML > '') rowFilled += cellHTML;
            else cellsToRemove.push(calendarCellElements[i+c]);
        }
        const timeCell = calendarTimeElements[timeCellCounter];
        if (!rowFilled) {
            //console.log(`remove cells fo row №${timeCellCounter+1} : `, cellsToRemove);
            //console.log(`remove time row: ${timeCell.innerText}`);
            cellsToRemove.forEach(cell => {cell.parentNode.removeChild(cell);});
            timeCell.parentNode.removeChild(timeCell);
        }
        else {
            //console.log(`Row № ${timeCell.innerText} is filled with`, rowFilled);
            break;
        }
    }
}
function setHoursIds () {
    document.querySelectorAll(`div[data-qa="table_Styled.Body"] div[data-qa="table_Styled.Item"]`).forEach ((el,id) => {
        el.dataset.weekHourId = id;
    });
}
function repostitionTimeLine() {
    const calendarTimeLine = document.querySelector('div[data-qa="table_Styled.Line"]');
    const dt = new Date();
    if (calendarTimeLine && calendarTimeLine.parentNode) {
        const currentCellId = (dt.getHours()*7-1)+dt.getDay();
        const currentCell = document.querySelector(`div[data-qa="table_Styled.Body"] div[data-week-hour-id="${currentCellId}"]`);
        if (currentCell && !currentCell.isSameNode(calendarTimeLine.parentNode)) {
            console.log('repostitionTimeLine… move to', currentCell);
            calendarTimeLine.parentNode.removeChild(calendarTimeLine);
            currentCell.style.backgroundColor = 'lyghtyellow';
            console.log(currentCell);
            currentCell.appendChild(calendarTimeLine);
            document.querySelector('div[data-qa="table_Scrollable"]>div').scrollTop = 0;
        }
    }
    if (calendarTimeLine) {
        const currentHourPercent = Math.round(dt.getMinutes()*100/60, 2);
        console.log('repostitionTimeLine… to ', currentHourPercent, '%');
        calendarTimeLine.style.top = `${currentHourPercent}%`;
    }
    window.setTimeout(repostitionTimeLine, 30000);
}


function reflowDelay() {
    const observer = new MutationObserver(function (mutations, me) {
        const calendarCellElements = document.querySelectorAll('div[data-qa="table_Styled.Body"] div[data-qa="table_Styled.Item"]');
        const calendarTimeElements = document.querySelectorAll('div[data-qa="table_Styled.TimeWrapper"]>div');
        const calendarCalendarCard = document.querySelectorAll('div[data-qa="calendar-card_Root"]');
        const calendarTableBody = document.querySelector('div[data-qa="calendar-layout_Styled.Root"]');
        const calendarTimeLine = document.querySelector('div[data-qa="table_Styled.Line"]');
        const calendarTimeZoneText = document.querySelector('div[data-qa="moscow-time_Root"] div[class*="Text_root"]');
        if (calendarTimeZoneText) calendarTimeZoneText.innerHTML = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (calendarTimeLine) { setHoursIds(); repostitionTimeLine(); }
        if (calendarTableBody && calendarCellElements.length && calendarTimeElements.length === 24 && calendarCalendarCard.length) {
            console.log(`calendarTimeElements = `, calendarTimeElements.length);
            console.log(`calendarCellElements = `, calendarCellElements.length);
            console.log(`calendarCalendarCard = `, calendarCalendarCard.length);
            reflow(Array.from(calendarCellElements), Array.from(calendarTimeElements));
            me.disconnect(); // stop observing



            const calendarTableBodyOobserver = new MutationObserver(function () {
                const calendarCellElements = document.querySelectorAll('div[data-qa="table_Styled.Body"] div[data-qa="table_Styled.Item"]');
                const calendarTimeElements = document.querySelectorAll('div[data-qa="table_Styled.TimeWrapper"]>div');
                const calendarCalendarCard = document.querySelectorAll('div[data-qa="calendar-card_Root"]');
                const calendarTimeLine = document.querySelector('div[data-qa="table_Styled.Line"]');
                if (calendarCellElements.length && calendarTimeElements.length === 24 && calendarCalendarCard.length) {
                    if (calendarTimeLine) { setHoursIds(); repostitionTimeLine(); }
                    reflow(Array.from(calendarCellElements), Array.from(calendarTimeElements));
                }

            });

            calendarTableBodyOobserver.observe(calendarTableBody, {
                childList: true,
                subtree: true
            });

            return;
        }
    });

    observer.observe(document, {
        childList: true,
        subtree: true
    });

}



if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
        reflowDelay();
    });
} else {
    reflowDelay();
}
