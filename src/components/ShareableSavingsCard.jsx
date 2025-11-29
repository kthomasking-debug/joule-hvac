import React from 'react';

// 1200x630 social card (OG image size) with branded gradient
const ShareableSavingsCard = ({ savings, location }) => (
  <div id="share-card" className="w-[1200px] h-[630px] bg-gradient-to-br from-green-400 to-blue-500 p-16 flex flex-col justify-center items-center text-white font-sans relative rounded-2xl">
    <p className="text-4xl font-medium drop-shadow-sm">I'm projected to save</p>
    <p className="text-9xl font-black my-4 drop-shadow-md">${Math.round(savings)}/year</p>
    <p className="text-4xl font-medium drop-shadow-sm">on home heating{location ? ` in ${location}` : ''}!</p>
    <p className="absolute bottom-8 text-2xl opacity-80">Calculated with Joule HVAC</p>
  </div>
);

export default ShareableSavingsCard;
