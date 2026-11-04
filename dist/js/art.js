const art = {
  jungle: `<defs>
    <linearGradient id="jg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#315c4b"/><stop offset=".6" stop-color="#1a3a30"/><stop offset="1" stop-color="#081410"/></linearGradient>
    <radialGradient id="jl" cx=".68" cy=".28" r=".6"><stop offset="0" stop-color="#f1cf86" stop-opacity=".8"/><stop offset="1" stop-color="#f1cf86" stop-opacity="0"/></radialGradient>
    <linearGradient id="jfog" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b6d4b8" stop-opacity="0"/><stop offset="1" stop-color="#b6d4b8" stop-opacity=".15"/></linearGradient>
  </defs>
  <rect width="900" height="260" fill="url(#jg)"/>
  <rect width="900" height="260" fill="url(#jl)"/>
  <g fill="#07130f" opacity=".9">
    <path d="M0 260V120l35-25 20 10 30-45 28 18 20 30 35-12 18 28V260z"/>
    <path d="M690 260V94l40-18 22 14 32-28 28 22 20 36 40-10 28 24v166z"/>
    <rect x="290" y="110" width="340" height="150"/>
    <path d="M270 112h380l-35-28H305z"/>
    <path d="M310 82h300l-28-22H338z"/>
    <rect x="340" y="150" width="40" height="110"/><rect x="420" y="150" width="30" height="110"/><rect x="500" y="150" width="40" height="110"/><rect x="570" y="150" width="26" height="110"/>
    <path d="M280 260V160h30v100M650 260V160h26v100"/>
  </g>
  <g stroke="#6ea985" stroke-width="2" fill="none" opacity=".55">
    <path d="M40 0c30 50-15 80 20 120s-5 80 18 140"/>
    <path d="M105 0c-20 60 20 80-5 130s20 70 4 130"/>
    <path d="M815 0c20 50-15 90 5 130s-10 70 12 130"/>
  </g>
  <g fill="#0b1d17" opacity=".8">
    <path d="M0 230c120-30 250-5 390 18s300 16 510-12v24H0z"/>
    <path d="M600 214l30-50 14 44-28 20z"/><path d="M90 226l22-38 10 30-20 18z"/>
  </g>
  <rect width="900" height="260" fill="url(#jfog)"/>
  <g fill="#e8d9a6" opacity=".6"><circle cx="600" cy="60" r="2"/><circle cx="640" cy="100" r="1.2"/><circle cx="530" cy="45" r="1.5"/></g>`,
  echoes: `<defs>
    <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#11383c"/><stop offset="1" stop-color="#050f12"/></linearGradient>
    <radialGradient id="el" cx=".5" cy=".45" r=".55"><stop offset="0" stop-color="#9ff3e2" stop-opacity=".55"/><stop offset="1" stop-color="#9ff3e2" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="900" height="260" fill="url(#eg)"/>
  <g stroke="#3c7c74" fill="none" opacity=".5">
    <path d="M450 60l-160 200M450 60l-80 200M450 60v200M450 60l80 200M450 60l160 200"/>
    <ellipse cx="450" cy="130" rx="230" ry="60"/><ellipse cx="450" cy="130" rx="170" ry="40"/><ellipse cx="450" cy="130" rx="100" ry="22"/>
  </g>
  <rect width="900" height="260" fill="url(#el)"/>
  <g fill="#031012" opacity=".92">
    <path d="M0 260V80l55 20 30-40 26 55 50-18 18 44v119z"/>
    <path d="M900 260V70l-60 24-32-46-24 58-55-16-18 44v126z"/>
    <rect x="210" y="120" width="30" height="140"/><rect x="660" y="120" width="30" height="140"/>
    <path d="M225 120l-20-25h40zM675 120l-20-25h40z"/>
  </g>
  <g fill="none" stroke="#8ee7d7" stroke-width="1.2" opacity=".5">
    <circle cx="450" cy="130" r="26"/><circle cx="450" cy="130" r="40"/><circle cx="450" cy="130" r="55"/>
    <path d="M450 89l15 41-15 41-15-41z"/>
  </g>
  <g fill="#c8fff2" opacity=".6"><circle cx="300" cy="70" r="1.5"/><circle cx="610" cy="55" r="2"/><circle cx="560" cy="190" r="1.2"/><circle cx="350" cy="200" r="1"/></g>`,
  sunken: `<defs>
    <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b3640"/><stop offset=".65" stop-color="#061c24"/><stop offset="1" stop-color="#020c10"/></linearGradient>
    <linearGradient id="sw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e8da0" stop-opacity=".35"/><stop offset="1" stop-color="#2e8da0" stop-opacity="0"/></linearGradient>
    <radialGradient id="sl" cx=".5" cy=".2" r=".55"><stop offset="0" stop-color="#a5f3ff" stop-opacity=".5"/><stop offset="1" stop-color="#a5f3ff" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="900" height="260" fill="url(#sg)"/>
  <g fill="#020e12" opacity=".92">
    <rect x="90" y="105" width="90" height="155"/><rect x="220" y="70" width="110" height="190"/><rect x="380" y="120" width="80" height="140"/><rect x="500" y="55" width="120" height="205"/><rect x="670" y="95" width="100" height="165"/>
    <path d="M210 72l70-35 60 35zM480 58l80-35 75 35zM660 98l55-30 55 30zM80 108l55-30 55 30z"/>
    <rect x="245" y="105" width="16" height="30" fill="#2e8da0"/><rect x="535" y="90" width="16" height="26" fill="#2e8da0"/><rect x="700" y="125" width="14" height="24" fill="#2e8da0"/>
    <rect x="410" y="150" width="12" height="22" fill="#2e8da0"/>
  </g>
  <rect y="190" width="900" height="70" fill="url(#sw)"/>
  <rect width="900" height="260" fill="url(#sl)"/>
  <g stroke="#7fe1ee" fill="none" opacity=".3">
    <path d="M0 205c100-15 180 15 280 2s180-18 280 0 200 8 340-10"/>
    <path d="M0 225c130-10 210 12 320 0s180-14 300 4 190 4 280-8"/>
    <path d="M0 245c120-8 210 10 330-2s220-10 330 5 160 2 240-6"/>
  </g>
  <g fill="#bdf7ff" opacity=".4"><circle cx="620" cy="80" r="2"/><circle cx="680" cy="140" r="1.2"/><circle cx="180" cy="50" r="1.5"/></g>`,
  library: `<defs>
    <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#211827"/><stop offset="1" stop-color="#08060c"/></linearGradient>
    <radialGradient id="ll" cx=".5" cy=".3" r=".6"><stop offset="0" stop-color="#d8b56e" stop-opacity=".5"/><stop offset="1" stop-color="#d8b56e" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="900" height="260" fill="url(#lg)"/>
  <rect width="900" height="260" fill="url(#ll)"/>
  <g fill="#0c0911" opacity=".95">
    <rect x="60" y="40" width="260" height="220"/><rect x="580" y="40" width="260" height="220"/>
    <rect x="350" y="30" width="200" height="230"/>
    <rect x="80" y="55" width="220" height="10"/><rect x="80" y="95" width="220" height="10"/><rect x="80" y="135" width="220" height="10"/><rect x="80" y="175" width="220" height="10"/>
    <rect x="600" y="55" width="220" height="10"/><rect x="600" y="95" width="220" height="10"/><rect x="600" y="135" width="220" height="10"/><rect x="600" y="175" width="220" height="10"/>
    <rect x="370" y="55" width="160" height="180"/>
    <path d="M330 30l120-25 120 25-30 12H360z"/>
  </g>
  <g fill="#c9a96b" opacity=".5">
    <rect x="95" y="70" width="8" height="22"/><rect x="110" y="68" width="6" height="24"/><rect x="128" y="72" width="9" height="20"/><rect x="155" y="69" width="7" height="23"/>
    <rect x="615" y="70" width="8" height="22"/><rect x="640" y="66" width="6" height="26"/><rect x="675" y="72" width="9" height="20"/><rect x="700" y="69" width="7" height="23"/>
  </g>
  <g stroke="#c9a96b" fill="none" opacity=".45">
    <circle cx="450" cy="120" r="32"/><circle cx="450" cy="120" r="46"/><path d="M450 74l14 35-14 46-14-46z"/>
  </g>
  <g fill="#f0dca3" opacity=".55"><circle cx="450" cy="150" r="2"/><circle cx="250" cy="40" r="1.2"/><circle cx="650" cy="50" r="1.4"/></g>
  <path d="M0 245c180-20 350 18 520 2s280 6 380-8v21H0z" fill="#050408" opacity=".8"/>`,
  sanctuary: `<defs>
    <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b1e13"/><stop offset=".6" stop-color="#190c08"/><stop offset="1" stop-color="#070302"/></linearGradient>
    <radialGradient id="tl" cx=".5" cy=".42" r=".5"><stop offset="0" stop-color="#ffe7a5" stop-opacity=".9"/><stop offset=".5" stop-color="#ff9a45" stop-opacity=".3"/><stop offset="1" stop-color="#ff9a45" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="900" height="260" fill="url(#tg)"/>
  <g fill="#0a0503" opacity=".95">
    <path d="M0 260V40h70v220zM830 260V40h70v220z"/>
    <rect x="70" y="95" width="80" height="165"/><rect x="750" y="95" width="80" height="165"/>
    <rect x="150" y="60" width="20" height="200"/><rect x="730" y="60" width="20" height="200"/>
    <rect x="170" y="55" width="560" height="16"/>
    <path d="M170 55l280-40 280 40-40 10H210z"/>
    <rect x="250" y="150" width="400" height="110"/>
    <path d="M230 150h440l-40-30H270z"/>
  </g>
  <g fill="none" stroke="#ffcf7a" opacity=".55">
    <circle cx="450" cy="120" r="55"/><circle cx="450" cy="120" r="78"/><circle cx="450" cy="120" r="100"/>
    <path d="M450 20v200M350 120h200M380 50l140 140M520 50L380 190"/>
  </g>
  <rect width="900" height="260" fill="url(#tl)"/>
  <g fill="#ffdf9a" opacity=".7"><circle cx="450" cy="120" r="4"/><circle cx="300" cy="70" r="1.6"/><circle cx="610" cy="80" r="2"/><circle cx="680" cy="200" r="1.4"/><circle cx="220" cy="190" r="1.2"/></g>
  <path d="M0 245c160-10 300 15 450-2s280-8 450 6v11H0z" fill="#050201" opacity=".9"/>`,
  secret: `<defs>
    <linearGradient id="kg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#27213a"/><stop offset="1" stop-color="#08060e"/></linearGradient>
    <radialGradient id="kl" cx=".5" cy=".5" r=".55"><stop offset="0" stop-color="#fff1c4" stop-opacity=".65"/><stop offset="1" stop-color="#fff1c4" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="900" height="260" fill="url(#kg)"/>
  <g fill="none" stroke="#8d7fae" opacity=".35">
    <ellipse cx="450" cy="130" rx="360" ry="110"/><ellipse cx="450" cy="130" rx="270" ry="80"/><ellipse cx="450" cy="130" rx="180" ry="52"/>
  </g>
  <rect width="900" height="260" fill="url(#kl)"/>
  <g fill="#08060e" opacity=".9">
    <path d="M0 260V90l80 30 40-40 50 50 40-20v150z"/>
    <path d="M900 260V90l-80 30-40-40-50 50-40-20v150z"/>
    <rect x="330" y="90" width="240" height="170"/>
    <path d="M310 92h280l-30-30H340z"/>
    <rect x="430" y="110" width="40" height="150" fill="#120e1d"/>
  </g>
  <g fill="none" stroke="#e8d29c" opacity=".55">
    <circle cx="450" cy="130" r="26"/><circle cx="450" cy="130" r="46"/><path d="M450 78l18 52-18 52-18-52z"/>
  </g>
  <g fill="#fff4cf" opacity=".7"><circle cx="450" cy="130" r="2.2"/><circle cx="380" cy="70" r="1.2"/><circle cx="540" cy="60" r="1.6"/><circle cx="300" cy="200" r="1.2"/><circle cx="620" cy="190" r="1.5"/></g>`,
};

export function chapterArt(name) {
  return `<svg viewBox="0 0 900 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${art[name] || art.jungle}</svg>`;
}
