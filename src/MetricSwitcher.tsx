import {useState} from 'react';
import {Activity,CheckCheck,Clock3,GraduationCap} from 'lucide-react';
import {dayMetrics,metricLabels,metricSeries,metricValue,type MetricKey} from './metrics';
import {dayKey,type State} from './domain';

const choices:[MetricKey,typeof CheckCheck][]=[['completed',CheckCheck],['worth',Clock3],['focus',Activity],['learning',GraduationCap]];
export default function MetricSwitcher({state,day}:{state:State;day:string}){
 const [metric,setMetric]=useState<MetricKey>('completed');
 const current=dayMetrics(state,day),series=metricSeries(state,day),value=metricValue(current,metric),weekly=series.reduce((sum,item)=>sum+metricValue(item,metric),0);
 const max=Math.max(1,...series.map(item=>metricValue(item,metric)));
 return <section className="metric-deck" aria-label="Daily progress metrics"><div className="metric-deck-title"><div><p className="eyebrow">YOUR RHYTHM</p><h2>Progress has more than one shape.</h2></div><span>{day===dayKey()?'Today':day}</span></div><div className="metric-deck-body"><div className="metric-selector" role="group" aria-label="Choose progress metric">{choices.map(([key,Icon])=><button key={key} aria-pressed={metric===key} onClick={()=>setMetric(key)}><Icon size={17}/><span>{metricLabels[key].short}</span></button>)}</div><div className="metric-sculpture"><div className="metric-disc"><span>{value}</span><small>{metricLabels[metric].unit}</small></div><div className="metric-caption"><strong>{metricLabels[metric].title}</strong><span>{weekly} {metricLabels[metric].unit} across these seven days</span><small>{value===0?'Nothing recorded for this date yet.':'A real piece of your progress.'}</small></div></div><div className="metric-mini-chart" aria-label={`Seven-day ${metricLabels[metric].title.toLowerCase()} trend`}>{series.map(item=><div key={item.day} title={`${item.day}: ${metricValue(item,metric)} ${metricLabels[metric].unit}`}><i style={{height:`${metricValue(item,metric)===0?0:Math.max(6,metricValue(item,metric)/max*100)}%`}}/><span>{new Date(item.day+'T12:00:00').toLocaleDateString('en-IN',{weekday:'short'})}</span></div>)}</div></div></section>;
}
