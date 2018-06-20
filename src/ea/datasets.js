var ea_datasets = [
  {
    id: "dummy",
    description: "Dummy dataset",

    url: "./data/empty_8bui.tif",
    parse: ea_datasets_tiff_url,

    band: 0,
  },
  {
    id: "ghi",
    description: "Solar Potential",
    unit: "kWh/m<sup>2</sup>",
    preload: false,

    url: "./data/ghi.tif",
    parse: ea_datasets_tiff_url,

    // endpoint: `${ea_database}/ghi_tiff_materialized`,
    // parse: ea_datasets_tiff_stream,

    clamp: false,
    domain: [500, 2800],
    range: [0,1],
    color_scale: 'hot-reverse',
    weight: 2,

    band: 0,
    active: false,
  },
  {
    id: "poverty",
    description: "Poverty",
    unit: "< 2USD/day",
    preload: false,

    url: "./data/poverty.tif",
    parse: ea_datasets_tiff_url,

    // endpoint: `${ea_database}/poverty_tiff`,
    // parse: ea_datasets_tiff_stream,

    clamp: false,
    domain: [0, 1],
    range: [0, 1],
    color_scale: 'yignbu-reverse',
    weight: 5,

    band: 0,
    active: false,
  },
  {
    id: "schools",
    description: "Schools",
    preload: false,

    endpoint: `${ea_database}/envelope_schools`,
    parse: ea_datasets_points,

    hide: ea_map_unload,
    symbol: "square",

    datatype: "boolean",
    active: false,
  },
  {
    id: "schools-distance",
    description: "Distance to schools",
    unit: "km",
    preload: false,

    url: "./data/schools_distance.tif",
    parse: ea_datasets_tiff_url,

    // endpoint: `${ea_database}/schools_distance_tiff_resampled_materialized`,
    // parse: ea_datasets_tiff_stream,

    clamp: true,
    domain: [120, 0],
    range: [0, 1],
    color_scale: 'greys',
    weight: 3,

    band: 0,
    active: false,
  },
  {
    id: "transmission-lines",
    description: "Transmission Lines Exclusion",
    preload: false,
    unit: "km",

    init: 20,
    steps: [1, 10, 20, 30, 50, 100],

    endpoint: `${ea_database}/rpc/transmission_lines_buffered_tiff`,
    parse: ea_datasets_tiff_rpc_stream,

    scale: 'identity',
    clamp: false,
    domain: [0,1],
    range: [0,-1],
    weight: Infinity,

    band: 0,
    datatype: "boolean",

    active: false,
  },
  {
    id: "transmission-lines-polygon",
    description: "Transmission Lines Polygons",
    preload: false,

    init: 20,
    steps: [1, 10, 20, 30, 50, 100],

    endpoint: `${ea_database}/rpc/merged_transmission_lines_geojson`,
    parse: async function(v) {
      await ea_client(this, 'POST',
        { km: (v || this.init) },
        (r) => {
          this.features = [r[0]['payload']];

          ea_map_load_features(
            ea_map,
            this.features,
            'transmission-lines-polygon',
            null
          );
        }
      );
    },

    hide: ea_map_unload,

    datatype: "boolean",
    active: false,
  },
  {
    id: "facilities",
    description: "Facilities",
    preload: false,

    endpoint: `${ea_database}/envelope_facilities`,
    parse: ea_datasets_points,

    hide: ea_map_unload,
    symbol: "cross",

    datatype: "boolean",
    active: false,
  },
  {
    id: "mines",
    description: "Mines",
    preload: false,

    endpoint: `${ea_database}/envelope_mines`,
    parse: ea_datasets_points,

    hide: ea_map_unload,
    symbol: "wye",

    datatype: "boolean",
    active: false,
  },
  {
    id: "powerplants",
    description: "Power Plants",
    preload: false,

    endpoint: `${ea_database}/envelope_powerplants`,
    parse: ea_datasets_points,

    hide: ea_map_unload,
    symbol: "star",

    datatype: "boolean",
    active: false,
  },
  {
    id: "hydro",
    description: "Hydro",
    preload: false,

    endpoint: `${ea_database}/envelope_hydro`,
    parse: ea_datasets_points,

    hide: ea_map_unload,
    symbol: "circle",

    active: false,
  },
  {
    id: "population disabled",
    description: "Population density",
    unit: "people/30m<sup>2</sup>",
    preload: false,

    // url: null,
    endpoint: `${ea_database}/population_materialized`,
    parse: null,

    clamp: false,
    domain: [0, 1000],
    range: [0, 1],
    color_scale: 'viridis',
    weight: 5,

    band: 0,
    active: false,
  },
];

const ea_datasets_category_tree = [{
  "name": "demand",
  "subcategories": [{
    "name": "demographics",
    "datasets": [
      "population",
      "poverty",
    ]
  }, {
    "name": "productive-uses",
    "datasets": [
      "schools",
      "schools-distance",
      "facilities",
      "mines",
      "crops",
    ]
  }],
}, {
  "name": "supply",
  "subcategories": [{
    "name": "resources",
    "datasets": [
      "ghi",
    ]
  }, {
    "name": "infrastructure",
    "datasets": [
      "hydro",
      "powerplants",
      "transmission-lines",
      "transmission-lines-polygon",
    ]
  }]
}];

function ea_datasets_scale_fn(ds) {
  var s = null;

  const lin = d3.scaleLinear()
        .domain(ds.tmp_domain || ds.domain)
        .range([0,1])

  switch (ds.scale) {

  case 'identity':
    s = d3.scaleIdentity()
      .domain(ds.tmp_domain || ds.domain)
      .range(ds.range);
    break;

  case 'linear':
  default:
    s = lin.clamp(ds.clamp)
    break;
  }

  return s;
}

async function ea_datasets_load(ds,v) {
  ea_ui_dataset_loading(ds, true);

  await ds.parse.call(ds,v);

	ea_ui_dataset_loading(ds, false);
}

async function ea_datasets_features(ds) {
  await ea_client(ds, 'GET', null,
    (r) => {
      ds.features = r[0]['jsonb_build_object'].features;

      ea_map_load_features(
        ea_map,
        ds.features,
        ds.id,
        null
      );
    }
  );
}

async function ea_datasets_points() {
  const ds = this;

  const load_em = () => {
    ea_map_load_points(
      ea_map,
      ds.features,
      ds.id,
      ds.symbol,
      null
    )
  }

  if (ds.features) load_em();
  else
    await ea_client(
      ds, 'GET', null,
      (r) => {
        ds.features = r[0]['jsonb_build_object'].features;
        load_em();
      }
    );

  return ds;
}

async function ea_datasets_tiff(ds, method, payload) {
  if (ds.raster) ;
  else {
    const tiff = await method(payload);
    const image = await tiff.getImage();
    const rasters = await image.readRasters();

    ds.tiff = tiff;
    ds.image = image;
    ds.raster = rasters[ds.band];

    ds.width = image.getWidth();
    ds.height = image.getHeight();

    ds.nodata = parseFloat(ds.tiff.fileDirectories[0][0].GDAL_NODATA);
  }

  return ds;
}

async function ea_datasets_hexblob(hex) {
  var byteBuf = new Uint8Array(new ArrayBuffer(hex.length/2));

  for (var i = 0; i < hex.length; i += 2)
    byteBuf[i/2] = parseInt(hex.slice(i, i+2), 16);

  const blob = new Blob([byteBuf], {type: "image/tiff"});
  // ea_fake_download(blob);

  return blob;
}

async function ea_datasets_tiff_stream() {
  const ds = this;

  if (ds.raster) ;
  else {
    var data = null;

    await ea_client(ds, 'GET', null, (r) => data = r);

    await ea_datasets_tiff(
      ds,
      GeoTIFF.fromBlob,
      (await ea_datasets_hexblob(data[0]['tiff'].slice(2))));
  }

  return ds;
}

async function ea_datasets_tiff_rpc_stream(v) {
  const ds = this;

  if (ds.raster) ;
  else {
    var data = null;

    const payload = { };
    payload[ds.unit] = v || ds.init;

    await ea_client(ds, 'POST', payload, (r) => data = r);

    await ea_datasets_tiff(
      ds,
      GeoTIFF.fromBlob,
      (await ea_datasets_hexblob(data[0]['tiff'].slice(2))));
  }

  return ds;
}

async function ea_datasets_tiff_url() {
  const ds = this;

  if (ds.raster) ;
  else await ea_datasets_tiff(ds, GeoTIFF.fromUrl, ds.url);

  return ds;
}
