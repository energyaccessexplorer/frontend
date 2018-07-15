mapbox = null;

mapbox_setup = (bounds) => {
  if (!ea_settings.mapboxstyle) {
    console.info("mapbox_setup: Mapbox disabled. Return.")
    return;
  }

  mapboxgl.accessToken = ea_settings.mapbox_token;

  mapbox = new mapboxgl.Map({
    container: 'mapbox-container',
    style: `mapbox://styles/mapbox/${ea_settings.mapboxstyle}-v9`,
    interactive: false,
  });

  mapbox.fitBounds(bounds, { animate: false });
};
