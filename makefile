# Copy and customise these in a default.mk
#
# WEB_PORT = 4231
# PGREST_PORT = 6798
#
# SRV_USER = someuser
# SRV_SERVER = example.org
# SRV_DEST = /srv/http/energyaccessexplorer
#
# DB_SERV_DEV = http://localhost:${PGREST_PORT}
# DB_SERV_PROD = https://api-energyaccessexplorer.example.org
#
# STATIC_SERVER = python3 -m http.server ${WEB_PORT}
# WATCH = <whatever daemon you use observe code changes>
#
include default.mk

DIST = ./dist
SRC = ./src
VIEWS = ./views
CSS = ./stylesheets
LIB = ${DIST}/lib

default: build

build: build-tool build-countries

start:
	(cd ${DIST} && ${STATIC_SERVER}) &
	@postgrest postgrest.conf &

watch:
	@ WATCH_CMD="make build" ${WATCH} ${SRC} ${CSS} ${VIEWS}

stop:
	-@lsof -t -i :${WEB_PORT} | xargs -i kill {}
	-@lsof -t -i :${PGREST_PORT} | xargs -i kill {}

build-tool:
	@echo "Building tool"
	@mkdir -p ${DIST}/tool
	@cp ${VIEWS}/tool.html ${DIST}/tool/index.html

	@cat \
		${LIB}/d3.js \
		${LIB}/geotiff.js \
		${LIB}/plotty.js \
		${LIB}/mapbox-gl.js \
		${LIB}/flash.js \
		${LIB}/modal.js \
		${LIB}/location.js \
		${LIB}/htmlsortable.js \
		> ${DIST}/tool/libs.js

	@echo -n "const ea_settings = " | cat - \
		settings.json \
		${SRC}/ea.js \
		${SRC}/auxiliary.js \
		${SRC}/client.js \
		${SRC}/svg.js \
		${SRC}/controls.js \
		${SRC}/ui.js \
		${SRC}/layers.js \
		${SRC}/datasets.js \
		${SRC}/mapbox.js \
		> ${DIST}/tool/main.js

	@cat \
	  ${CSS}/layout.css \
	  ${CSS}/controls.css \
	  ${CSS}/maparea.css \
	  ${CSS}/layers.css \
	  ${CSS}/datasets.css \
	  ${CSS}/views.css \
		> ${DIST}/tool/main.css

build-countries:
	@echo "Building countries"
	@mkdir -p ${DIST}/countries
	@cp ${VIEWS}/countries.html ${DIST}/countries/index.html

	@cat \
		${LIB}/d3.js \
		${LIB}/topojson.js \
		${LIB}/flash.js \
		${LIB}/modal.js \
		> ${DIST}/countries/libs.js

	@echo -n "const ea_settings = " | cat - \
		settings.json \
		${SRC}/svg.js \
		${SRC}/ui.js \
		${SRC}/countries.js \
		> ${DIST}/countries/main.js

	@cat \
	  ${CSS}/countries.css \
	  ${CSS}/maparea.css \
	  ${CSS}/views.css \
		> ${DIST}/countries/main.css

synced:
	@rsync -OPrv \
		--dry-run \
		--info=FLIST0 \
		--checksum \
		--copy-links \
		--delete-before \
		--exclude=.git \
		--exclude=default.mk \
		--exclude=makefile \
		${DIST}/ ${SRV_USER}@${SRV_SERVER}:${SRV_DEST}

deploy:
	@sed -i \
		-e 's%"database": "${DB_SERV_DEV}",%"database": "${DB_SERV_PROD}",%' \
		settings.json

	make build

	@rsync -OPrv \
		--checksum \
		--copy-links \
		--delete-before \
		--exclude=.git \
		--exclude=default.mk \
		--exclude=makefile \
		${DIST}/ ${SRV_USER}@${SRV_SERVER}:${SRV_DEST}

	@sed -i \
		-e 's%"database": "${DB_SERV_PROD}",%"database": "${DB_SERV_DEV}",%' \
		settings.json
