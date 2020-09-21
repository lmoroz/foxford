// ==UserScript==
// @name         Foxford fill Teachers
// @description  Расширение для сайта foxford.ru: выводит ИМЕНА ПРЕПОДАВАТЕЛЕЙ и даты начала-окончания курсов в списке программ обучения на https://foxford.ru/dashboard
// @namespace    https://github.com/lmoroz/foxford
// @version      0.1
// @author       Larisa Morozhnikova
// @match        https://foxford.ru/dashboard
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let courses = [];

    const reformat = async function () {

        fillCourses();

        const links = document.evaluate("//a[contains(., 'Добавить курс')]", document, null, XPathResult.ANY_TYPE, null );
        const addLink = links.iterateNext();

        if(!addLink || !courses.length) {
            window.setTimeout(reformat, 1000);
            return;
        }

        const style = document.createElement('style');
        style.textContent = `
.teacherData {margin: 10px 0; color: #777; }
.tooltipElement {display: flex; align-items; center;}
.tooltipText {margin: 0 10px;}
div.base-course { background: #48a1e624;}
div.deep-course { background-color: #82d18024;}`;
        document.head.append(style);

        colorCourses();
        await fillNextTeacher();
    }

    const fillCourses = function () {

        courses = [];

        const coursesBlocks = document.querySelectorAll('div[class^="CourseItem_root"]');
        coursesBlocks.forEach(block => {
            if (block.dataset.teacher) return;
            let linkBlock = false; let link = false; let detailsBlock = false; let tooltipBlock = false;
            linkBlock = block.querySelector('a');
            detailsBlock = block.querySelector('div[class^="CourseItem_details"]');
            tooltipBlock = block.querySelector('div[class^="CourseItem_tooltipWrapper"]');
            console.log({block, tooltipBlock, detailsBlock});
            if(linkBlock && detailsBlock && tooltipBlock)
            {
                link = 'https://foxford.ru/api'+linkBlock.getAttribute('href')+'/landing';
                courses.push({block, link, detailsBlock, tooltipBlock});
            }
        });
    }

    function colorCourses () {
        const baseCourseCards = [];
        const deepCourseCards = [];
        const baseSubTitles = ['Базовый уровень',
                               'Эстрадная музыка',
                               'Классическая музыка',
                               'Второй год обучения',
                              ];
        const deepSubTitles = ['Углублённый уровень',
                               'Текст в радость',
                               'Мнемотехника',
                               'астрономия',
                               'шифры',
                               'алгоритм',
                               'программир',
                              ];
        try {
            baseSubTitles.forEach(baseSubTitle => {
                const baseSubTitleItems = document.evaluate("//h4[contains(translate(.,'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЬЫЪЭЮЯ','абвгдеёжзийклмнопрстуфхцчшщьыъэюя'), '" + baseSubTitle.toLowerCase() + "')]", document, null, XPathResult.ANY_TYPE, null );
                let baseSubTitleElement = baseSubTitleItems.iterateNext();
                console.log({baseSubTitle, baseSubTitleItems, baseSubTitleElement});
                while (baseSubTitleElement) {
                    const baseSubTitleCourseCard = baseSubTitleElement.closest('div[class^="CourseItem_root"]');
                    console.log({baseSubTitle, baseSubTitleElement, baseSubTitleCourseCard});
                    if (baseSubTitleCourseCard) baseCourseCards.push(baseSubTitleCourseCard);
                    baseSubTitleElement = baseSubTitleItems.iterateNext();
                }
            });
            deepSubTitles.forEach(deepSubTitle => {
                const deepSubTitleItems = document.evaluate("//h4[contains(translate(.,'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЬЫЪЭЮЯ','абвгдеёжзийклмнопрстуфхцчшщьыъэюя'), '" + deepSubTitle.toLowerCase() + "')]", document, null, XPathResult.ANY_TYPE, null );
                let deepSubTitleElement = deepSubTitleItems.iterateNext();
                console.log({deepSubTitle, deepSubTitleItems, deepSubTitleElement});
                while (deepSubTitleElement) {
                    const deepSubTitleCourseCard = deepSubTitleElement.closest('div[class^="CourseItem_root"]');
                    console.log({deepSubTitle, deepSubTitleElement, deepSubTitleCourseCard});
                    if (deepSubTitleCourseCard) deepCourseCards.push(deepSubTitleCourseCard);
                    deepSubTitleElement = deepSubTitleItems.iterateNext();
                }
            });
            console.log({baseCourseCards, deepCourseCards});
            baseCourseCards.forEach(card => card.classList.add('base-course'));
            deepCourseCards.forEach(card => card.classList.add('deep-course'));
        }
        catch (e) {
            console.error(e);
        }
    }

    const fillTeachersOnScroll = async function (event) {
        fillCourses();
        colorCourses();
        if(courses.length > 0 ) await fillNextTeacher();
    }

    const fillNextTeacher = async function () {
        const currentBlock = courses.shift();
        if(currentBlock && !currentBlock.block.dataset.teacher) {
            const req = await fetch(currentBlock.link);
            const resp = await req.json();
            const teacher = resp.teachers[0];
            const teacherName = `${teacher.last_name} ${teacher.first_name} ${teacher.middle_name}`;
            const startAt = resp.starts_at;
            const endAt = resp.finishes_at;
            console.log(teacherName, startAt);

            currentBlock.block.dataset.teacher = teacherName;

            let teacherDataBlock = currentBlock.detailsBlock.querySelector('div.teacherData');
            if(!teacherDataBlock) {
                teacherDataBlock = document.createElement('div');
                teacherDataBlock.classList.add('teacherData');
                teacherDataBlock.innerHTML = `${teacherName}<br><small>с ${startAt} по ${endAt}</small>`;

                currentBlock.detailsBlock.append(teacherDataBlock);


                const tooltipTextBlock = document.createElement('span');
                tooltipTextBlock.classList.add('tooltipText');
                tooltipTextBlock.innerHTML = `В архив`;

                currentBlock.tooltipBlock.prepend(tooltipTextBlock);
                currentBlock.tooltipBlock.classList.add('tooltipElement');
            }
        }
        if(courses.length > 0 ) await fillNextTeacher();
        return true;
    }

    setTimeout(reformat, 3000);
    window.addEventListener('scroll', fillTeachersOnScroll);
})();
