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
// @global       moment
// ==/UserScript==

console.log('intercept');

const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const userTimeZoneOffset = (new Date().getTimezoneOffset())/60;
const userLocale = Intl.DateTimeFormat().resolvedOptions().locale;
const arrays = ['course_lessons', 'coach_lessons','events'];
const timeLineSelectors = ['div[class^="styled__Line-"]', 'div[data-qa="table_Styled.Line"]'];
const timeZoneSelectors = ['div[class^="moscow-time__Root-"] div[class^="Text_root"]', 'div[data-qa="moscow-time_Root"] div[class*="Text_root"]'];
const styledBodySelectors = ['div[class^="styled__BodyContainer"]', 'div[data-qa="table_Styled.Body"]'];
const hourCellSelectors = [`${styledBodySelectors[0]} div[class^="styled__Item"]`, `${styledBodySelectors[1]} div[data-qa="table_Styled.Item"]`];
const timeWrapperSelectors = ['div[class^="styled__TimeWrapper"]', 'div[data-qa="table_Styled.TimeWrapper"]'];
const calendarTableBodySelectors = ['div[data-qa="calendar-layout_Styled.Root"]','div[class^="base__ContentContainer"]'];
const calendarScrollBodySelectors = ['div[data-qa="table_Scrollable"]>div', `${calendarTableBodySelectors[1]} div[style*="overflow: scroll"]:nth-child(2)`];

const ElementsWithScrolls = (function() {
    const getComputedStyle = (document.body && document.body.currentStyle)
        ? elem => elem.currentStyle
        : elem => document.defaultView.getComputedStyle(elem, null);

    function getActualCss(elem, style) {
        return getComputedStyle(elem)[style];
    }

    function autoOrScroll(text) {
        return text == 'scroll' || text == 'auto';
    }

    function isXScrollable(elem) {
        return elem.offsetWidth < elem.scrollWidth &&
            autoOrScroll(getActualCss(elem, 'overflow-x'));
    }

    function isYScrollable(elem) {
        return elem.offsetHeight < elem.scrollHeight &&
            autoOrScroll(getActualCss(elem, 'overflow-y'));
    }

    function hasScrollerAndScrolled(elem) {
        return (isYScrollable(elem) || isXScrollable(elem)) && parseInt(elem.scrollTop) !== 0;
    }
    return function ElemenetsWithScrolls() {
        return [].filter.call(document.querySelectorAll('*'), hasScrollerAndScrolled);
    };
})();

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
            //console.log(`remove cells for row №${timeCellCounter+1} : `, cellsToRemove);
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
    let hourCells = document.querySelectorAll(hourCellSelectors[0]);
    if (!hourCells.length) hourCells = document.querySelectorAll(hourCellSelectors[1]);
    if (hourCells.length) {
        hourCells.forEach ((el,id) => {
            el.dataset.weekHourId = id;
        });}
}
function repostitionTimeLine() {
    const dt = new Date();
    let calendarTimeLine = document.querySelector(timeLineSelectors[0]);
    if (!calendarTimeLine) calendarTimeLine = document.querySelector(timeLineSelectors[1]);
    if (calendarTimeLine && calendarTimeLine.parentNode) {
        const currentCellId = (dt.getHours()*7-1)+dt.getDay();

        let currentCell = document.querySelector(`${styledBodySelectors[0]} div[data-week-hour-id="${currentCellId}"]`);
        if (!currentCell) currentCell = document.querySelector(`${styledBodySelectors[1]} div[data-week-hour-id="${currentCellId}"]`);

        if (currentCell && !currentCell.isSameNode(calendarTimeLine.parentNode)) {
            console.log('repostitionTimeLine… move to', currentCell);
            calendarTimeLine.parentNode.removeChild(calendarTimeLine);

            currentCell.style.backgroundColor = 'lyghtyellow';
            console.log({currentCell});
            currentCell.appendChild(calendarTimeLine);

            let calendarScrolledElements = ElementsWithScrolls();
            if (calendarScrolledElements.length) calendarScrolledElements.forEach(el => { el.scrollTop = 0; });
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
        let calendarCellElements = document.querySelectorAll(hourCellSelectors[0]);
        if (!calendarCellElements.length) calendarCellElements = document.querySelectorAll(hourCellSelectors[1]);

        let calendarTimeElements = document.querySelectorAll(`${timeWrapperSelectors[0]}>div`);
        if (!calendarTimeElements.length) calendarTimeElements = document.querySelectorAll(`${timeWrapperSelectors[1]}>div`);


        let calendarTimeLine = document.querySelector(timeLineSelectors[0]);
        if (!calendarTimeLine) calendarTimeLine = document.querySelector(timeLineSelectors[1]);

        let calendarTimeZoneText = document.querySelector(timeZoneSelectors[0]);
        if (!calendarTimeZoneText) calendarTimeZoneText = document.querySelector(timeZoneSelectors[1]);

        let calendarTableBody = document.querySelector(calendarTableBodySelectors[0]);
        if (!calendarTableBody ) calendarTableBody = document.querySelector(calendarTableBodySelectors[1]);


        if (calendarTableBody && calendarCellElements.length && calendarTimeElements.length === 24) {
            console.log(`calendarTimeElements = `, calendarTimeElements.length);
            console.log(`calendarCellElements = `, calendarCellElements.length);

            if (calendarTimeLine) {
                setHoursIds();
                repostitionTimeLine();
            }
            if (calendarTimeZoneText) calendarTimeZoneText.innerHTML = Intl.DateTimeFormat().resolvedOptions().timeZone;

            reflow(Array.from(calendarCellElements), Array.from(calendarTimeElements));
            me.disconnect(); // stop observing



            const calendarTableBodyOobserver = new MutationObserver(function () {

                let calendarCellElements = document.querySelectorAll(hourCellSelectors[0]);
                if (!calendarCellElements.length) calendarCellElements = document.querySelectorAll(hourCellSelectors[1]);

                let calendarTimeElements = document.querySelectorAll(`${timeWrapperSelectors[0]}>div`);
                if (!calendarTimeElements.length) calendarTimeElements = document.querySelectorAll(`${timeWrapperSelectors[1]}>div`);

                let calendarTimeLine = document.querySelector(timeLineSelectors[0]);
                if (!calendarTimeLine) calendarTimeLine = document.querySelector(timeLineSelectors[1]);

                if (calendarCellElements.length && calendarTimeElements.length === 24) {
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
