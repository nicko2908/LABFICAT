const t=new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0});function e(n){const r=Number(n);return Number.isFinite(r)?t.format(r):"-"}export{e as f};
