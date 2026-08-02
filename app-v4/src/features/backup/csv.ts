type CsvCell=string|number|boolean|null|undefined;
function cell(value:CsvCell):string{let text=String(value??'');if(/^[=+\-@]/.test(text))text=`'${text}`;return /[",\r\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text;}
export function csv(rows:CsvCell[][]):string{return `\uFEFF${rows.map((row)=>row.map(cell).join(',')).join('\r\n')}\r\n`;}
export function sessionsCsv(sessions:{date:string;day:string;title:string;durationSec:number|null;volume:number;exerciseCount:number}[]):string{return csv([['date','day','title','minutes','volume','exercises'],...sessions.map((item)=>[item.date,item.day,item.title,item.durationSec===null?'':Math.round(item.durationSec/60),item.volume,item.exerciseCount])]);}
