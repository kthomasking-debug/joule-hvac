import React, { useState } from 'react';
import { Thermometer, Zap, Clock, Snowflake, Wind, DollarSign, TrendingUp, AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';

const HeatPumpGuide = () => {
  const [activeSection, setActiveSection] = useState('intro');
  const [expandedQuestion, setExpandedQuestion] = useState(null);

  const sections = [
    { id: 'intro', title: 'How It Works', icon: Thermometer },
    { id: 'behavior', title: 'Normal Behavior', icon: Clock },
    { id: 'aux-heat', title: 'Auxiliary Heat', icon: Zap },
    { id: 'cold-weather', title: 'Cold Weather', icon: Snowflake },
    { id: 'efficiency', title: 'Efficiency Tips', icon: DollarSign },
    { id: 'comfort', title: 'Comfort', icon: Wind },
  ];

  const questions = {
    intro: [
      {
        q: "Why doesn't my heat pump blast hot air like a gas furnace?",
        a: "Heat pumps work differently! They deliver air at 85-95°F vs. gas furnaces at 120-140°F. They run longer but use less energy, gently warming your home over time.",
        visual: "temp-compare"
      },
      {
        q: "Why does it run almost all the time?",
        a: "This is totally normal! Heat pumps are designed for continuous operation at lower capacity. It's actually more efficient than the on/off cycling of traditional systems.",
        visual: "runtime"
      }
    ],
    behavior: [
      {
        q: "Why does it only raise the temperature 1-2°F per hour?",
        a: "Heat pumps are 'low and slow' heaters. They maintain temperature efficiently rather than providing rapid bursts of heat. Think marathon runner, not sprinter!",
        visual: "heating-rate"
      },
      {
        q: "What's that steam coming from my outdoor unit?",
        a: "That's the defrost cycle! When frost builds up, your system briefly reverses to melt ice. It's completely normal and happens more often in humid, near-freezing conditions.",
        visual: "defrost"
      }
    ],
    'aux-heat': [
      {
        q: "Why did my auxiliary heat turn on?",
        a: "Auxiliary (strip) heat kicks in when: the temperature difference is too large (usually >3°F), outdoor temps are very cold, or you're recovering from a setback. It's expensive - use sparingly!",
        visual: "aux-trigger"
      },
      {
        q: "How much more expensive is auxiliary heat?",
        a: "Strip heat can cost 2-3x more per hour than the heat pump alone! A typical heat pump uses 2-4 kW while strips use 5-15 kW. Avoid large temperature setbacks.",
        visual: "cost-compare"
      }
    ],
    'cold-weather': [
      {
        q: "How cold can it get before my heat pump struggles?",
        a: "Most heat pumps work well down to 25-35°F. Below that, efficiency drops and auxiliary heat may run more. Modern cold-climate models work down to -15°F or lower!",
        visual: "cold-performance"
      },
      {
        q: "Is frost on the outdoor unit normal?",
        a: "Yes! Light frost is normal between 32-45°F with high humidity. Heavy ice buildup may indicate a problem. Watch for defrost cycles - they should clear the frost.",
        visual: "frost"
      }
    ],
    efficiency: [
      {
        q: "Should I use temperature setbacks with a heat pump?",
        a: "Keep setbacks small (2-3°F max) or maintain steady temps! Large setbacks trigger expensive auxiliary heat during recovery. Night setbacks often cost MORE than keeping it steady.",
        visual: "setback-strategy"
      },
      {
        q: "What's the most cost-efficient way to run my system?",
        a: "For most climates: maintain consistent temperature, avoid setbacks >3°F, let it run continuously, and only use emergency heat in true emergencies.",
        visual: "efficiency-tips"
      }
    ],
    comfort: [
      {
        q: "Why does my house feel drafty while heating?",
        a: "The air is cooler (85-95°F vs your body at 98.6°F), so it feels drafty even though your house is warm. Adjusting airflow, using ceiling fans in reverse, and proper insulation help.",
        visual: "comfort"
      },
      {
        q: "How can I improve comfort without wasting energy?",
        a: "Use ceiling fans on low (reverse in winter), seal air leaks, add insulation, consider a humidifier in winter, and ensure proper airflow by changing filters monthly.",
        visual: "comfort-tips"
      }
    ]
  };

  const Visual = ({ type }) => {
    const visuals = {
      'temp-compare': (
        <div className="flex justify-around items-end h-40 bg-gradient-to-t from-blue-50 to-white rounded-lg p-4">
          <div className="text-center">
            <div className="bg-blue-400 rounded-t-lg w-20 mb-2" style={{height: '80px'}}></div>
            <div className="text-sm font-semibold text-gray-800">Heat Pump</div>
            <div className="text-xs text-gray-600">85-95°F</div>
          </div>
          <div className="text-center">
            <div className="bg-orange-500 rounded-t-lg w-20 mb-2" style={{height: '140px'}}></div>
            <div className="text-sm font-semibold text-gray-800">Gas Furnace</div>
            <div className="text-xs text-gray-600">120-140°F</div>
          </div>
        </div>
      ),
      'runtime': (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-full bg-blue-400 h-4 rounded"></div>
              <span className="text-xs whitespace-nowrap text-gray-800">Heat Pump: Steady</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1/4 bg-orange-500 h-4 rounded"></div>
              <div className="w-1/4 bg-gray-200 h-4 rounded"></div>
              <div className="w-1/4 bg-orange-500 h-4 rounded"></div>
              <span className="text-xs whitespace-nowrap text-gray-800">Furnace: On/Off</span>
            </div>
          </div>
        </div>
      ),
      'heating-rate': (
        <div className="bg-gradient-to-br from-orange-50 to-blue-50 rounded-lg p-4">
          <div className="text-center mb-3 text-sm font-semibold text-gray-800">Temperature Rise Over Time</div>
          <div className="flex items-end justify-around h-32">
            <div className="flex flex-col items-center gap-1">
              <div className="w-12 bg-blue-300 rounded-t" style={{height: '30px'}}></div>
              <div className="text-xs text-gray-700">1hr</div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-12 bg-blue-400 rounded-t" style={{height: '60px'}}></div>
              <div className="text-xs text-gray-700">2hr</div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-12 bg-blue-500 rounded-t" style={{height: '90px'}}></div>
              <div className="text-xs text-gray-700">3hr</div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-12 bg-blue-600 rounded-t" style={{height: '120px'}}></div>
              <div className="text-xs text-gray-700">4hr</div>
            </div>
          </div>
          <div className="text-center mt-2 text-xs text-gray-600">Slow & steady wins the race!</div>
        </div>
      ),
      'cost-compare': (
        <div className="flex justify-around items-end h-48 bg-gradient-to-t from-green-50 to-white rounded-lg p-4">
          <div className="text-center">
            <div className="bg-green-400 rounded-t-lg w-24 mb-2 flex items-end justify-center pb-2" style={{height: '80px'}}>
              <DollarSign className="w-8 h-8 text-white" />
            </div>
            <div className="text-sm font-semibold text-gray-800">Heat Pump</div>
            <div className="text-xs text-gray-600">2-4 kW</div>
            <div className="text-xs font-bold text-green-600 mt-1">~$0.30/hr</div>
          </div>
          <div className="text-center">
            <div className="bg-red-500 rounded-t-lg w-24 mb-2 flex items-end justify-center pb-2" style={{height: '180px'}}>
              <div className="flex">
                <DollarSign className="w-8 h-8 text-white" />
                <DollarSign className="w-8 h-8 text-white" />
                <DollarSign className="w-8 h-8 text-white" />
              </div>
            </div>
            <div className="text-sm font-semibold text-gray-800">Auxiliary Heat</div>
            <div className="text-xs text-gray-600">5-15 kW</div>
            <div className="text-xs font-bold text-red-600 mt-1">~$1.20/hr</div>
          </div>
        </div>
      ),
      'aux-trigger': (
        <div className="bg-gradient-to-br from-yellow-50 to-red-50 rounded-lg p-4">
          <div className="text-center mb-3 text-sm font-semibold text-gray-800">What Triggers Auxiliary Heat?</div>
          <div className="space-y-2">
            <div className="flex items-center gap-3 bg-white/50 rounded p-2">
              <Zap className="w-5 h-5 text-orange-500 flex-shrink-0" />
              <div className="text-xs text-gray-700">Temperature gap &gt; 3°F</div>
            </div>
            <div className="flex items-center gap-3 bg-white/50 rounded p-2">
              <Snowflake className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <div className="text-xs text-gray-700">Outdoor temp &lt; 35°F</div>
            </div>
            <div className="flex items-center gap-3 bg-white/50 rounded p-2">
              <Clock className="w-5 h-5 text-purple-500 flex-shrink-0" />
              <div className="text-xs text-gray-700">Large setback recovery</div>
            </div>
            <div className="flex items-center gap-3 bg-white/50 rounded p-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div className="text-xs text-gray-700">Emergency heat mode</div>
            </div>
          </div>
        </div>
      ),
      'defrost': (
        <div className="bg-gradient-to-br from-blue-100 via-white to-blue-100 rounded-lg p-6">
          <div className="flex justify-around items-center">
            <div className="text-center">
              <Snowflake className="w-16 h-16 mx-auto text-blue-400 mb-2" />
              <div className="text-xs font-semibold text-gray-800">Frost Buildup</div>
            </div>
            <div className="text-2xl text-gray-600">→</div>
            <div className="text-center">
              <Wind className="w-16 h-16 mx-auto text-orange-400 mb-2" />
              <div className="text-xs font-semibold text-gray-800">Defrost Cycle</div>
            </div>
            <div className="text-2xl text-gray-600">→</div>
            <div className="text-center">
              <CheckCircle className="w-16 h-16 mx-auto text-green-400 mb-2" />
              <div className="text-xs font-semibold text-gray-800">Clear & Running</div>
            </div>
          </div>
        </div>
      ),
      'cold-performance': (
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4">
          <div className="text-center mb-3 text-sm font-semibold text-gray-800">Heat Pump Efficiency vs Temperature</div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-16 text-xs text-gray-700 font-medium">45°F+</div>
              <div className="flex-1 bg-green-400 h-6 rounded flex items-center justify-center text-xs text-white font-semibold">100% Efficient</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-16 text-xs text-gray-700 font-medium">35°F</div>
              <div className="flex-1 bg-yellow-400 h-6 rounded flex items-center justify-center text-xs text-white font-semibold" style={{width: '85%'}}>85% Efficient</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-16 text-xs text-gray-700 font-medium">25°F</div>
              <div className="flex-1 bg-orange-400 h-6 rounded flex items-center justify-center text-xs text-white font-semibold" style={{width: '65%'}}>65% Efficient</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-16 text-xs text-gray-700 font-medium">15°F</div>
              <div className="flex-1 bg-red-400 h-6 rounded flex items-center justify-center text-xs text-white font-semibold" style={{width: '45%'}}>45% Efficient</div>
            </div>
          </div>
        </div>
      ),
      'frost': (
        <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-white/50 rounded">
              <CheckCircle className="w-10 h-10 mx-auto text-green-500 mb-2" />
              <div className="text-xs font-semibold text-gray-800 mb-1">Normal Frost</div>
              <div className="text-xs text-gray-600">Light, even coating</div>
              <div className="text-xs text-gray-600">32-45°F range</div>
            </div>
            <div className="text-center p-3 bg-white/50 rounded">
              <AlertCircle className="w-10 h-10 mx-auto text-red-500 mb-2" />
              <div className="text-xs font-semibold text-gray-800 mb-1">Problem Ice</div>
              <div className="text-xs text-gray-600">Heavy buildup</div>
              <div className="text-xs text-gray-600">Call for service</div>
            </div>
          </div>
        </div>
      ),
      'setback-strategy': (
        <div className="space-y-3 bg-gradient-to-r from-red-50 to-green-50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-red-700">Large Setback (5-8°F)</div>
              <div className="text-xs text-red-600">Triggers expensive auxiliary heat!</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-green-700">Small Setback (2-3°F)</div>
              <div className="text-xs text-green-600">Heat pump can recover efficiently</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-green-700">Steady Temperature</div>
              <div className="text-xs text-green-600">Usually most economical!</div>
            </div>
          </div>
        </div>
      ),
      'efficiency-tips': (
        <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-lg p-4">
          <div className="text-center mb-3 text-sm font-semibold text-gray-800">Cost Savings Strategy</div>
          <div className="space-y-2">
            <div className="flex items-start gap-2 bg-white/50 rounded p-2">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">1</div>
              <div className="text-xs text-gray-700">Maintain steady temperature (no big swings)</div>
            </div>
            <div className="flex items-start gap-2 bg-white/50 rounded p-2">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">2</div>
              <div className="text-xs text-gray-700">Change filters monthly for optimal airflow</div>
            </div>
            <div className="flex items-start gap-2 bg-white/50 rounded p-2">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">3</div>
              <div className="text-xs text-gray-700">Let it run continuously - it's designed for this!</div>
            </div>
            <div className="flex items-start gap-2 bg-white/50 rounded p-2">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">4</div>
              <div className="text-xs text-gray-700">Avoid emergency heat unless truly needed</div>
            </div>
          </div>
        </div>
      ),
      'comfort': (
        <div className="bg-gradient-to-br from-orange-50 to-pink-50 rounded-lg p-4">
          <div className="text-center mb-3 text-sm font-semibold text-gray-800">Why It Feels Cooler</div>
          <div className="flex justify-around items-center mb-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500">85-95°F</div>
              <div className="text-xs text-gray-600">Heat Pump Air</div>
            </div>
            <div className="text-xl text-gray-400">&lt;</div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">98.6°F</div>
              <div className="text-xs text-gray-600">Your Body</div>
            </div>
          </div>
          <div className="text-xs text-center text-gray-700 bg-white/50 rounded p-2">
            Air cooler than your body temperature feels like a breeze, even when room is warm!
          </div>
        </div>
      ),
      'comfort-tips': (
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-2 bg-white/50 rounded">
              <Wind className="w-8 h-8 mx-auto text-purple-500 mb-1" />
              <div className="text-xs font-semibold text-gray-800">Ceiling Fans</div>
              <div className="text-xs text-gray-600">Reverse in winter</div>
            </div>
            <div className="text-center p-2 bg-white/50 rounded">
              <Thermometer className="w-8 h-8 mx-auto text-blue-500 mb-1" />
              <div className="text-xs font-semibold text-gray-800">Insulation</div>
              <div className="text-xs text-gray-600">Seal air leaks</div>
            </div>
            <div className="text-center p-2 bg-white/50 rounded">
              <div className="text-2xl mb-1">💧</div>
              <div className="text-xs font-semibold text-gray-800">Humidifier</div>
              <div className="text-xs text-gray-600">Feels warmer</div>
            </div>
            <div className="text-center p-2 bg-white/50 rounded">
              <div className="text-2xl mb-1">🔧</div>
              <div className="text-xs font-semibold text-gray-800">Clean Filters</div>
              <div className="text-xs text-gray-600">Better airflow</div>
            </div>
          </div>
        </div>
      )
    };
    
    return visuals[type] || <div className="h-40 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">Visual</div>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <Thermometer className="w-16 h-16 mx-auto text-blue-300" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent">
            Understanding Your Heat Pump
          </h1>
          <p className="text-xl text-blue-200">Everything you need to know, beautifully explained</p>
        </div>

        {/* Navigation Pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {sections.map(section => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => {
                  setActiveSection(section.id);
                  setExpandedQuestion(null);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                  activeSection === section.id
                    ? 'bg-white text-purple-900 shadow-lg scale-105'
                    : 'bg-white/10 hover:bg-white/20 backdrop-blur'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{section.title}</span>
              </button>
            );
          })}
        </div>

        {/* Questions Section */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 md:p-8 shadow-2xl">
          <div className="space-y-4">
            {questions[activeSection]?.map((item, idx) => (
              <div
                key={idx}
                className="bg-white/5 backdrop-blur rounded-xl overflow-hidden border border-white/10 hover:border-white/30 transition-all"
              >
                <button
                  onClick={() => setExpandedQuestion(expandedQuestion === idx ? null : idx)}
                  className="w-full p-4 md:p-6 flex items-start gap-4 text-left hover:bg-white/5 transition-colors"
                >
                  <HelpCircle className="w-6 h-6 text-blue-300 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg md:text-xl font-semibold mb-1">{item.q}</h3>
                    {expandedQuestion !== idx && (
                      <p className="text-sm text-blue-200">Click to learn more</p>
                    )}
                  </div>
                  <div className={`transform transition-transform ${expandedQuestion === idx ? 'rotate-180' : ''}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                
                {expandedQuestion === idx && (
                  <div className="px-4 md:px-6 pb-6 space-y-4 animate-fadeIn">
                    <div className="pl-10">
                      <p className="text-blue-100 leading-relaxed mb-4">{item.a}</p>
                      {item.visual && <Visual type={item.visual} />}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Quick Tips Footer */}
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          <div className="bg-green-500/20 backdrop-blur rounded-xl p-4 border border-green-400/30">
            <TrendingUp className="w-8 h-8 text-green-300 mb-2" />
            <h4 className="font-semibold mb-1">Save Money</h4>
            <p className="text-sm text-green-100">Keep steady temps, avoid large setbacks</p>
          </div>
          <div className="bg-blue-500/20 backdrop-blur rounded-xl p-4 border border-blue-400/30">
            <Snowflake className="w-8 h-8 text-blue-300 mb-2" />
            <h4 className="font-semibold mb-1">Cold Weather</h4>
            <p className="text-sm text-blue-100">Frost and defrost cycles are normal</p>
          </div>
          <div className="bg-purple-500/20 backdrop-blur rounded-xl p-4 border border-purple-400/30">
            <Clock className="w-8 h-8 text-purple-300 mb-2" />
            <h4 className="font-semibold mb-1">Be Patient</h4>
            <p className="text-sm text-purple-100">Heat pumps work slowly but efficiently</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeatPumpGuide;
