/*
 * ea_state_sync
 *
 * Gather the parameters from the current URL, clean them up, set the defaults
 *
 * returns an Object with the handled params and their set_ methods.
 */

function ea_state_sync() {
  let mode, output, inputs, preset;

  let mode_param = location.get_query_param('mode');
  let output_param = location.get_query_param('output');
  let inputs_param = location.get_query_param('inputs');
  let preset_param = location.get_query_param('preset');

  function set_mode_param(m) {
    history.replaceState(null, null, location.set_query_param('mode', (m || mode)));
  };

  function set_output_param(o) {
    history.replaceState(null, null, location.set_query_param('output', (o || output)));
  };

  function set_inputs_param(i) {
    history.replaceState(null, null, location.set_query_param('inputs', (i || inputs).toString()));
  };

  function set_preset_param(p) {
    qs('#controls-preset').value = (p || 'custom');
    history.replaceState(null, null, location.set_query_param('preset', (p || 'custom')));
  };

  if (Object.keys(ea_indexes).includes(output_param)) {
    output = output_param;
  } else {
    output = "eai";
    set_output_param();
  }

  if (!inputs_param) {
    inputs = [];
    set_inputs_param();
  } else {
    inputs = inputs_param.split(',');
  }

  if (Object.keys(ea_views).includes(mode_param)) {
    mode = mode_param;
  } else {
    mode = 'outputs';
    set_mode_param();
  }

  if (['market','planning', 'investment', 'custom'].includes(preset_param)) {
    preset = preset_param;
  } else {
    preset = 'custom';
    set_preset_param();
  }

  return {
    mode: mode,
    set_mode_param: set_mode_param,
    output: output,
    set_output_param: set_output_param,
    inputs: inputs,
    set_inputs_param: set_inputs_param,
    preset: preset,
    set_preset_param: set_preset_param,
  };
};

/*
 * ea_canvas_plot
 *
 * Just a shorthand to plotty.plot
 * (see https://github.com/santilland/plotty.git)
 *
 * @param "raster" []numbers
 * @param "canvas" a canvas element (if null, will default to canvas#output)
 * @param "color_theme" string. name of the color scale to draw.
 *
 * returns a plotty object.
 */

function ea_canvas_plot(data, canvas, color_theme = 'ea') {
  const A = DS.get('boundaries');

  if (!data.length) {
    console.warn("ea_canvas_plot: no raster given. Filling up with a blank (transparent) one...");
    data = new Float32Array(A.raster.data.length).fill(-1);
  };

  if (!canvas) canvas = qs('canvas#output');

  const plot = new plotty.plot({
    canvas: canvas,
    data: data,
    width: A.raster.width,
    height: A.raster.height,
    domain: [0,1],
    noDataValue: -1,
    colorScale: color_theme,
  });

  plot.render();

  return plot;
};

/*
 * ea_summary
 *
 * Given the current dataset selection, calculate the population impact through
 * the 'population' dataset on all Indexes. Draw some pie graphs and a modal
 * about it.
 *
 * This is triggered by the "Snapshot" button.
 */

async function ea_summary() {
  const pop = DS.get('population');
  await pop.load('heatmap');
  const p = pop.raster.data;

  const content = ce('div');

  content.append(
    ce('div', "Share of population for each index and category", {
      style: `
text-transform: uppercase;
margin: 0 -1.2em 1.2em -1.2em;
padding-left: 1.2em;
padding-bottom: 1.2em;
border-bottom: 1px solid lightgray;`
    }));

  let graphs;
  const graphs_tab = ce('div', graphs = ce('div', null, { id: "graphs" }), { class: 'tab' });

  const sizes = {
    "eai": 100,
    "ani": 100,
    "demand": 50,
    "supply": 50,
  };

  const summary = {};

  const nodata = pop.nodata;

  Object.keys(ea_indexes).forEach(idxn => {
    let raster = ea_analysis(ea_list_filter_type(idxn), idxn);

    var f = d3.scaleQuantize().domain([0,1]).range(ea_color_scale.domain);

    let a = new Float32Array(raster.length).fill(-1);

    for (var i = 0; i < raster.length; i++) {
      const r = raster[i];
      a[i] = (r === -1) ? -1 : f(r);
    }

    let groups = [0, 0, 0, 0, 0];

    for (let i = 0; i < a.length; i++) {
      let x = a[i];
      let v = p[i];
      let t = 0;

      if (v == nodata) continue;

      if (x >= 0   && x < 0.2) t = 0;
      else if (x >= 0.2 && x < 0.4) t = 1;
      else if (x >= 0.4 && x < 0.6) t = 2;
      else if (x >= 0.6 && x < 0.8) t = 3;
      else if (x >= 0.8 && x <= 1)  t = 4;

      groups[t] += v;
    }

    let total = groups.reduce((a,b) => a + b, 0);
    let percs = groups.reduce((a,b) => { a.push(b/total); return a; }, []);

    summary[idxn] = groups;

    console.log(idxn, percs, groups);

    if (percs.includes(NaN)) return;

    let pie = ea_svg_pie(percs.map(x => [x]), 75, 0, ea_color_scale.stops, null);

    let e = ce('div', null, { style: "text-align: center; margin: 0 1em; max-width: 150px;" });
    const container = ce('div', null, { class: 'pie-svg-container' });

    e.append(container, ce('div', ea_indexes[idxn]['name']));

    pie.change(0);
    container.append(pie.svg);

    graphs.append(e);
  });

  const s = ea_color_scale.stops;

  const i20 = i => (20 * i) + "-" + (20 * (i+1));

  const legend = ce('div', null, { class: 'number-labels' });
  s.forEach((x,i) => legend.append(ce('div', i20(i), { style: `background-color: ${x};`})));

  const table = ce('table', null, { class: 'summary tab hidden' });
  let thead, tbody, thr;

  table.append(thead = ce('thead'), tbody = ce('tbody'));
  thead.append(thr = ce('tr', ce('th'), { class: 'number-labels-row' }));
  s.forEach((x,i) => thr.append(ce('th', i20(i), { style: `background-color: ${x};`})));

  for (var k in summary) {
    let tr = ce('tr', ce('td', ea_indexes[k]['name'], { class: 'index-name' }));
    s.forEach((x,i) => tr.append(ce('td', (summary[k][i]).toLocaleString())));

    tbody.append(tr);
  }

  let ss = true;

  const switcher = ce('button', "Summary Table", { class: 'big-green-button' });
  switcher.onclick = function() {
    ss = !ss;
    for (let e of qsa('.tab', content))
      e.classList.toggle('hidden');
    this.innerText = ss ? "Summary Table" : "Summary Graphs";
  };

  graphs_tab.append(legend);
  content.append(graphs_tab, table);

  ea_modal.set({
    header: "Snapshot",
    content: content,
    footer: switcher
  }).show();

  ea_report();

  return content;
};

/*
 * ea_summary_wrapper
 *
 * A hack. For javascript reasons, ea_ui_app_loading does not get executed in a
 * blocking manner.
 */

function ea_summary_wrapper() {
  const prom = new Promise((resolve, rej) => {
    ea_ui_app_loading(true);
    setTimeout(_ => resolve("Success!"), 100);
  });

  prom
    .then(ea_summary)
    .then(_ => ea_ui_app_loading(false));
};

/*
 * ea_list_filter_type
 *
 * Utility.
 *
 * @param "type" string. ID or indexname.
 */

function ea_list_filter_type(type) {
  let idxn;

  if (['supply', 'demand'].includes(type))
    idxn = d => d.indexname === type || d.indexname === null;

  else if (['eai', 'ani'].includes(type))
    idxn = d => true;

  else
    idxn = d => d.id === type;

  return DS.all.filter(d => d.active && idxn(d));
};

/*
 * ea_plot_active_analysis
 *
 * Utility.
 *
 * @param "type" string. ID or indexname.
 * @param "cs" string. Default color_theme to 'ea'.
 */

async function ea_plot_active_analysis(type, cs = 'ea') {
  const list = ea_list_filter_type(type);

  const raster = await ea_analysis(list, type);
  ea_canvas_plot(raster);

  qs('#canvas-output-select').value = type;
  qs('#index-graphs-title').innerText = ea_indexes[type]['name'];
  qs('#index-graphs-description').innerText = ea_indexes[type]['description'];

  // 'animate' is set to false on mapbox's configuration, since we don't want
  // mapbox eating the CPU at 60FPS for nothing.
  //
  let canvas_source = MAPBOX.getSource('output-source');
  if (canvas_source) {
    canvas_source.raster = raster;

    canvas_source.play();
    canvas_source.pause();
  }

  return raster;
};

/*
 * ea_coordinates_raster
 *
 * Transform a set of coordinates to the "relative position" inside a raster
 * that is bound to an area
 *
 * @param "coords" int[2]. Coordinates in Longitude/Latitude to be transformed.
 * @param "bounds" int[2][2]. Bounding box containing the raster data.
 * @param "raster" { width int, height int, novalue numeric, array numeric[] }
 *        full description.
 */

function ea_coordinates_raster(coords, bounds, raster) {
  if (coords.length !== 2)
    throw Error(`ea_coordinates_raster: expected and array of length 2. Got ${coords}`);

  const cw = bounds[1][0] - bounds[0][0];
  const ch = bounds[1][1] - bounds[2][1];

  let x = (coords[0] - bounds[0][0]);
  let y = (bounds[0][1] - coords[1]); // yes, right that is.

  a = null;

  if ((x > 0 && x < cw &&
       y > 0 && y < ch )) {
    a = {
      x: Math.floor((x * raster.width) / cw),
      y: Math.floor((y * raster.height) / ch)
    };

    let v = raster.data[(a.y * raster.width) + a.x];

    a.value = v === raster.nodata ? null : v;
  }

  return a;
};

function table_pointer(dict, prop, event) {
  const t = document.createElement('table');
  dict.forEach(e => {
    const tr = ce('tr');
    tr.append(ce('td', ce('strong', e.target)), ce('td', prop[e.dataset]));
    t.append(tr);
  });

  mapbox_pointer(t, event.originalEvent.pageX, event.originalEvent.pageY)
};

function hex_to_rgba(str) {
  let c;
  if (str.match(/^#([A-Fa-f0-9]{3}){1,2}$/)) {
    c = str.substring(1).split('');

    if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];

    c = '0x' + c.join('');

    return [(c>>16)&255, (c>>8)&255, c&255, 255];
  }

  throw new Error("hex_to_rgba: argument doesn't match");
};

function interval_index(v, arr, clamp) {
  // TODO: implement non-clamp?
  //
  for (let i = 0; i < arr.length-1; i++) {
    if (v >= arr[i] && v <= arr[i+1]) return i;
  }

  return -1;
};

function right_pane(t) {
  qs('#inputs-pane').style.display = (t === 'inputs') ? '' : 'none';
  qs('#indexes-pane').style.display = (t === 'outputs') ? '' : 'none';
};

function ea_nanny_init(state) {
  window.ea_nanny = new nanny(ea_nanny_steps);

  if (state.inputs.length > 1) return;
  if (state.mode !== "inputs") return;

  const w = localStorage.getItem('needs-nanny');

  if (!w || !w.match(/false/)) ea_nanny.start();
};

function ea_nanny_force_start() {
  history.replaceState(null, null, location.set_query_param('inputs', 'boundaries'));
  history.replaceState(null, null, location.set_query_param('output', 'eai'));
  history.replaceState(null, null, location.set_query_param('mode', 'inputs'));

  DS.all.filter(d => d.active && d.id !== 'boundaries').forEach(d => d.turn(false, false));

  ea_overlord({
    "type": "refresh",
    "target": null,
    "caller": "ea_nanny_force_start"
  });

  ea_nanny.start();
};

async function ea_boundaries_init() {
  if (!this) {
    ea_flash
      .type('error')
      .title("Misconfigured geography")
      .message(`
It's missing a 'boundaries' dataset. <b>I'm stoping here.</b>
Please report this to energyaccessexplorer@wri.org.
`)();

    throw `Geography is missing a 'boundaries' dataset.`;
  }

  this.active = true;

  await this.load('vectors');
  await this.load('heatmap');

  mapbox_fit(DS.get('boundaries').vectors.bounds);

  return true;
};
