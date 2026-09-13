import assert from 'node:assert/strict';
import {test, after} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {buildTcSectionIndex} from '../app/util/tcSectionIndex.ts';
const db = new DatabaseSync(fileURLToPath(new URL('../assets/scriptures_v2.1.db', import.meta.url)),{readOnly:true});
after(()=>db.close());
const source = db.prepare(`SELECT chapter_id,volume_id,book_id,book_chapter,chapter_name AS name
    FROM chapters WHERE volume_id='tc' AND book_id IN
    ('section','tcappendix','tcforeword','tccanonization','tcpreface','tcintro') ORDER BY chapter_id`).all();

test('all 185 sections appear once in numeric order, with their original navigation records',()=>{
    const before=structuredClone(source);
    const {items}=buildTcSectionIndex(source);
    const numbered=items.filter(x=>x.book_id==='section');
    assert.deepEqual(numbered.map(x=>Number(x.book_chapter)),Array.from({length:185},(_,i)=>i+1));
    for(const item of items) assert.ok(source.includes(item));
    assert.equal(items.length,source.length);
    assert.deepEqual(source.map(x=>({...x})),before.map(x=>({...x})));
    for(const special of [1,110,145,171]) {
        assert.equal(numbered[special-1].chapter_id, source.find(x=>x.book_id==='section' && Number(x.book_chapter)===special).chapter_id);
    }
});

test('1, 10, 20 through 180 jump to those exact sections, including after a numeric sort',()=>{
    const {items,shortcuts}=buildTcSectionIndex([...source].reverse());
    assert.deepEqual(shortcuts.map(x=>x.label),['↑','1',...Array.from({length:18},(_,i)=>String((i+1)*10)),'↓']);
    for(const shortcut of shortcuts.filter(x=>/^\d+$/.test(x.label))) {
        assert.equal(items[shortcut.index].book_id,'section');
        assert.equal(Number(items[shortcut.index].book_chapter),Number(shortcut.label));
    }
    assert.notEqual(items[shortcuts.find(x=>x.label==='10').index].name,'Section 11');
});

test('front matter and appendices remain reachable outside the numbered sections',()=>{
    const {items,shortcuts}=buildTcSectionIndex(source);
    assert.notEqual(items[0].book_id,'section');
    const appendix=shortcuts.find(x=>x.label==='↓');
    assert.equal(items[appendix.index].name,'Section Endnotes');
    assert.deepEqual(items.slice(appendix.index).map(x=>x.name),['Section Endnotes','Excluded Revelations','Timeline Of The Fathers','Maps']);
    assert.equal(shortcuts[0].index,0);
    assert.deepEqual(buildTcSectionIndex([]),{items:[],shortcuts:[]});
});
