import fs from 'node:fs';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
const targets=[['src/components/dashboard/deck-vault/DeckDetailWorkspace.tsx','buildShowcasePng'],['src/components/dashboard-v2/deck-vault/DeckShowcaseStudio.tsx','exportShowcase'],['src/components/dashboard-v2/inventory/TieredInventoryWorkspace.tsx','downloadSocialCard']];
function find(source,file,name){const sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let found;function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text===name)found={start:node.getStart(sf),end:node.end,text:node.getText(sf)};ts.forEachChild(node,visit)}visit(sf);if(!found)throw Error(name);return found;}
for(const[file,name]of targets){const before=execFileSync('git',['show',`HEAD:${file}`],{encoding:'utf8'}),current=fs.readFileSync(file,'utf8');const original=find(before,file,name),range=find(current,file,name);fs.writeFileSync(file,current.slice(0,range.start)+original.text+current.slice(range.end));console.log('Preserved fixed export palette:',name);}
