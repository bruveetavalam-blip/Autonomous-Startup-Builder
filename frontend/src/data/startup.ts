import type { Agent, Startup } from '../types';
export const workflowSteps = ['Idea', 'Research', 'Business Plan', 'Marketing', 'Revenue', 'Validator'];
export const validationMetrics = [
  { label: 'Market Potential', score: 88, status: 'Strong', trend: '+12%' }, { label: 'Competition Risk', score: 64, status: 'Moderate', trend: '-8%' },
  { label: 'Revenue Feasibility', score: 82, status: 'Promising', trend: '+18%' }, { label: 'Execution Difficulty', score: 71, status: 'Manageable', trend: '-4%' }
];
export const revenueData = [{month:'Aug', value:8},{month:'Sep',value:14},{month:'Oct',value:19},{month:'Nov',value:28},{month:'Dec',value:36},{month:'Jan',value:48},{month:'Feb',value:62},{month:'Mar',value:78}];
export const startups: Startup[] = [
  { name:'PulsePath', industry:'Health & Wellness', status:'In progress', score:91, date:'Today', summary:'AI-powered habit coaching for modern teams.' },
  { name:'SupplyLoop', industry:'SaaS', status:'Completed', score:86, date:'Jul 19, 2026', summary:'Procurement intelligence for independent retailers.' },
  { name:'FieldNote', industry:'Climate Tech', status:'Completed', score:84, date:'Jul 11, 2026', summary:'Field reporting for restoration projects.' },
  { name:'CraftCart', industry:'Commerce', status:'Draft', score:72, date:'Jul 04, 2026', summary:'Shared storefront tools for local makers.' }
];
export const agents: Agent[] = [
  {name:'Idea Analysis',description:'Clarifies your core opportunity',state:'completed',progress:100,elapsed:'01:42',activity:'Validated problem and audience'},
  {name:'Market Research',description:'Maps demand and market dynamics',state:'completed',progress:100,elapsed:'03:18',activity:'Identified $2.4B serviceable market'},
  {name:'Competitor Analysis',description:'Finds gaps in the competitive field',state:'completed',progress:100,elapsed:'02:06',activity:'Mapped 12 direct competitors'},
  {name:'Business Plan',description:'Shapes your operating blueprint',state:'running',progress:68,elapsed:'01:57',activity:'Building go-to-market plan'},
  {name:'Marketing',description:'Develops acquisition strategy',state:'waiting',progress:0,elapsed:'—',activity:'Waiting for business plan'},
  {name:'Revenue',description:'Models revenue and unit economics',state:'waiting',progress:0,elapsed:'—',activity:'Waiting for market inputs'},
  {name:'Validator',description:'Scores overall startup viability',state:'waiting',progress:0,elapsed:'—',activity:'Waiting for analysis'},
];
export const timeline = [
  ['Idea analyzed','Problem, audience, and key assumptions identified','09:41 AM'], ['Market research completed','Opportunity size and demand signals mapped','09:44 AM'],
  ['Competitors found','12 relevant companies added to the landscape','09:46 AM'], ['Business plan started','Building your structured operating plan','09:48 AM'],
  ['Marketing strategy queued','Acquisition channels ready to evaluate','Next'], ['Revenue estimation queued','Forecast will be based on plan inputs','Next']
];
