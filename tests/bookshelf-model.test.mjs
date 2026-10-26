import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from '../assets/vendor/three.module.js';
import { MODEL, createBookMesh, createBookshelfScene } from '../assets/js/bookshelf-model.mjs';
import { spineMatrix } from '../assets/js/book-geometry.mjs';

const layout = JSON.parse(await readFile(new URL('../assets/models/bookshelf-layout.json',import.meta.url),'utf8'));
const near = (a,b,tolerance=1e-6) => assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);

test('each shelf is flush with the supporting wall and its end caps face away from the centered camera',()=>{
  const {boards,wall,camera} = createBookshelfScene(layout);
  assert.equal(boards.length,2);
  for(const board of boards){
    const box = new THREE.Box3().setFromObject(board);
    near(box.min.z,wall.position.z,1e-4);
    assert.ok(camera.position.x>box.min.x&&camera.position.x<box.max.x);
    assert.equal(board.castShadow,true);
  }
  assert.equal(wall.receiveShadow,true);
  near(camera.position.x,0);
  near(camera.getWorldDirection(new THREE.Vector3()).x,0);
});

test('upper underside and lower top face have the correct relationship to eye level',()=>{
  const {boards,camera} = createBookshelfScene(layout);
  const upper = new THREE.Box3().setFromObject(boards[0]);
  const lower = new THREE.Box3().setFromObject(boards[1]);
  assert.ok(upper.min.y>camera.position.y);
  assert.ok(lower.max.y<camera.position.y);
});

test('resting books lie on a shelf and fit entirely within its depth',()=>{
  const {books,boards,wall} = createBookshelfScene(layout);
  for(const book of books.values()){
    assert.ok(boards.some(board=>Math.abs(book.position.y-board.userData.supportY)<1e-6));
    const box = new THREE.Box3().setFromObject(book);
    assert.ok(box.min.z>=wall.position.z);
    assert.ok(box.max.z<=0.0001);
    assert.equal(book.userData.hinge,'front-bottom-edge');
  }
});

test('live HTML projection matches all four actual 3D spine corners at rest and during the hinge',()=>{
  const {scene,books,camera} = createBookshelfScene(layout);
  for(const data of layout.books){
    const book = books.get(data.id);
    for(const angle of [0,4,9,12]){
      book.rotation.x=THREE.MathUtils.degToRad(angle);
      scene.updateMatrixWorld(true);
      const matrix=spineMatrix({height:data.height,frontInset:MODEL.frontInset*layout.unit},{vanishingX:layout.width/2-data.x,horizon:layout.horizon-data.y,distance:MODEL.cameraDistance*layout.unit},angle);
      for(const [x,y] of [[0,0],[data.width,0],[0,data.height],[data.width,data.height]]){
        const projected = new THREE.Vector3(x,data.height-y,0).applyMatrix4(book.matrixWorld).project(camera);
        const denominator=matrix[3]*x+matrix[7]*y+matrix[15];
        const htmlX=data.x+(matrix[0]*x+matrix[4]*y+matrix[12])/denominator;
        const htmlY=data.y+(matrix[1]*x+matrix[5]*y+matrix[13])/denominator;
        near((projected.x+1)*layout.width/2,htmlX);
        near((1-projected.y)*layout.height/2,htmlY);
      }
    }
  }
});

test('real mesh pivots stay planted while the rear bottom edge lifts',()=>{
  const {scene,books} = createBookshelfScene(layout);
  for(const book of books.values()){
    const front = new THREE.Vector3(0,0,0).applyMatrix4(book.matrixWorld);
    book.rotation.x=THREE.MathUtils.degToRad(book.userData.tiltAngle);
    scene.updateMatrixWorld(true);
    const tiltedFront=new THREE.Vector3(0,0,0).applyMatrix4(book.matrixWorld);
    near(tiltedFront.distanceTo(front),0);
    const rear=new THREE.Vector3(0,0,-MODEL.bookDepth*layout.unit).applyMatrix4(book.matrixWorld);
    assert.ok(rear.y>front.y);
  }
});

test('exported GLB contains the same shelf, book, wall, and camera nodes',async()=>{
  const bytes=await readFile(new URL('../assets/models/bookshelf.glb',import.meta.url));
  assert.equal(bytes.readUInt32LE(0),0x46546c67);
  assert.equal(bytes.readUInt32LE(4),2);
  assert.equal(bytes.readUInt32LE(8),bytes.length);
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  const names=new Set(json.nodes.map(node=>node.name));
  for(const name of ['shelf-top','shelf-bottom','Supporting wall','Centered bookshelf camera',...layout.books.map(book=>`book-${book.id}`)]) assert.ok(names.has(name),name);
  assert.equal(json.asset.version,'2.0');
});

test('camera depth precision separates the spine and paper on desktop and mobile',()=>{
  for(const scale of [1,.5625]){
    const scaled={...layout,unit:scale,width:layout.width*scale,height:layout.height*scale,horizon:layout.horizon*scale,shelves:layout.shelves.map(s=>({...s,x:s.x*scale,y:s.y*scale,width:s.width*scale,height:s.height*scale})),books:layout.books.map(b=>({...b,x:b.x*scale,y:b.y*scale,width:b.width*scale,height:b.height*scale}))};
    const {camera}=createBookshelfScene(scaled);
    const front=new THREE.Vector3(0,0,-MODEL.frontInset*scale).project(camera);
    const paper=new THREE.Vector3(0,0,-(MODEL.frontInset+MODEL.coverThickness*1.4)*scale).project(camera);
    const depthSteps=Math.abs(front.z-paper.z)/2*(2**24-1);
    assert.ok(depthSteps>100,`Only ${depthSteps} depth steps separate the front cover from the paper`);
  }
});


test('page blocks remain recessed below and between the hardcover boards',()=>{
  for(const data of layout.books){
    const mesh=createBookMesh(data,layout.unit);
    const paper=new THREE.Box3().setFromObject(mesh.getObjectByName('recessed-page-block'));
    const spine=new THREE.Box3().setFromObject(mesh.getObjectByName('rounded-spine'));
    const sideClearance=(MODEL.coverThickness+MODEL.pageSideGap)*layout.unit;
    near(paper.min.x,sideClearance,1e-4);
    near(data.width-paper.max.x,sideClearance,1e-4);
    near(data.height-paper.max.y,MODEL.pageInset*layout.unit,1e-4);
    assert.ok(paper.min.y>0);
    assert.ok(paper.max.z<spine.min.z-.5*layout.unit);
  }
});

test('both rows reveal at least three pixels of recessed paper at their active angle',()=>{
  const {scene,books,camera}=createBookshelfScene(layout);
  for(const book of books.values()){
    const expected=book.userData.shelfId==='top'?12:9;
    assert.equal(book.userData.tiltAngle,expected);
    book.rotation.x=THREE.MathUtils.degToRad(expected);
    scene.updateMatrixWorld(true);
    const paper=book.getObjectByName('recessed-page-block');
    const points=paper.geometry.getAttribute('position');
    let paperTop=Infinity;
    for(let i=0;i<points.count;i++){
      const point=new THREE.Vector3().fromBufferAttribute(points,i).applyMatrix4(paper.matrixWorld).project(camera);
      paperTop=Math.min(paperTop,(1-point.y)*layout.height/2);
    }
    const coverTop=new THREE.Vector3(book.userData.width/2,book.userData.height,0).applyMatrix4(book.matrixWorld).project(camera);
    assert.ok((1-coverTop.y)*layout.height/2-paperTop>3*layout.unit,book.name);
  }
});
