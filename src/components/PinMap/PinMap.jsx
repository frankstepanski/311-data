/*
  TODO:
    - implement reset function
    - put requests layer in separate file
    - put requests underneath large geo text
    - add popups
    - better to filter the requests layer or to change the data in the requests source?
*/

import React, { Component } from 'react';
import mapboxgl from 'mapbox-gl';
import { connect } from 'react-redux';
import PropTypes from 'proptypes';
import geojsonExtent from '@mapbox/geojson-extent';
import * as turf from '@turf/turf';
import { getPinInfoRequest } from '@reducers/data';
import { updateMapPosition } from '@reducers/ui';
import { REQUEST_TYPES } from '@components/common/CONSTANTS';

import RequestsLayer from './RequestsLayer';
import BoundaryLayer from './BoundaryLayer';
import AddressLayer from './AddressLayer';

import MapOverview from './MapOverview';
import MapSearch from './MapSearch';
import MapLayers from './MapLayers';
// import MapCharts from './MapCharts';
import MapMeta from './MapMeta';

import ncBoundaries from '../../data/nc-boundary-2019.json';
import ccBoundaries from '../../data/la-city-council-districts-2012.json';
import openRequests from '../../data/open_requests.json';

/////////////////// CONSTANTS ///////////////

mapboxgl.accessToken = process.env.MAPBOX_TOKEN;
const INITIAL_BOUNDS = geojsonExtent(ncBoundaries);

///////////////////// MAP ///////////////////

class PinMap extends Component {
  constructor(props) {
    super(props);

    this.state = {
      requests: this.convertRequests(),
      requestsLayer: 'request-circles',
      mapReady: false,
      selectedTypes: Object.keys(REQUEST_TYPES),
      selectedRegionName: 'All of Los Angeles'
    };

    this.map = null;
    this.requestsLayer = null;
    this.addressLayer = null;
    this.ncLayer = null;
    this.ccLayer = null;
  }

  componentDidMount() {
    this.map = new mapboxgl.Map({
      container: this.mapContainer,
      style: 'mapbox://styles/mapbox/dark-v10',
      bounds: INITIAL_BOUNDS,
      fitBoundsOptions: { padding: 50 },
      pitchWithRotate: false,
      dragRotate: false,
      touchZoomRotate: false
    });

    this.map.on('load', () => {
      this.requestsLayer = RequestsLayer({
        map: this.map,
        sourceData: this.state.requests
      });

      this.addressLayer = AddressLayer({
        map: this.map,
        onSelectRegion: geo => this.setState({ filterPolygon: geo })
      });

      this.ncLayer = BoundaryLayer({
        map: this.map,
        sourceId: 'nc',
        sourceData: ncBoundaries,
        idProperty: 'nc_id',
        onSelectRegion: geo => this.setState({ filterPolygon: geo })
      });

      this.ccLayer = BoundaryLayer({
        map: this.map,
        sourceId: 'cc',
        sourceData: ccBoundaries,
        idProperty: 'name',
        onSelectRegion: geo => this.setState({ filterPolygon: geo })
      });

      this.map.on('moveend', e => {
        this.updatePosition(this.map);
      });

      this.map.once('idle', e => {
        this.updatePosition(this.map);
        this.setState({ mapReady: true });
      });

      this.map.addControl(new mapboxgl.FullscreenControl(), 'bottom-left');
    });
  }

  componentDidUpdate(prevProps) {
    if (this.props.pinClusters !== prevProps.pinClusters) {
      const requests = this.convertRequests();
      this.setState({ requests });

      const source = this.map.getSource('requests');
      if (source)
        source.setData(requests);
    }
  }

  onGeocoderResult = ({ result }) => {
    if (result.properties.type === 'nc') {
      this.setState({ selectedRegionName: result.place_name });
      return this.ncLayer.zoomToRegion(result.id);
    }

    if (result.properties.type === 'cc') {
      this.setState({ selectedRegionName: result.place_name });
      return this.ccLayer.zoomToRegion(result.id);
    }

    this.setState({ selectedRegionName: `${result.address} ${result.text}` });
    this.addressLayer.setCenter({
      lng: result.center[0],
      lat: result.center[1]
    });
  }

  onChangeSearchTab = tab => {
    switch(tab) {
      case 'address':
        this.addressLayer.show();
        this.ncLayer.hide();
        this.ccLayer.hide();
        break;

      case 'nc':
        this.ncLayer.show();
        this.ccLayer.hide();
        this.addressLayer.hide();
        break;

      case 'cc':
        this.ccLayer.show();
        this.ncLayer.hide();
        this.addressLayer.hide();
        break;
    }

    this.zoomOut();
  }

  typeFilter = types => {
    return ['in', ['get', 'type'], ['literal', types]];
  }

  convertRequests = () => ({
    type: 'FeatureCollection',
    features: this.props.pinClusters.map(cluster => ({
      type: 'Feature',
      properties: {
        id: cluster.srnumber,
        type: cluster.requesttype,
        point_count: cluster.count
      },
      geometry: {
        type: 'Point',
        coordinates: [
          cluster.longitude,
          cluster.latitude
        ]
      }
    }))
  });

  updatePosition = map => {
    const { updatePosition } = this.props;
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    updatePosition({
      zoom,
      bounds: {
        _northEast: bounds.getNorthEast(),
        _southWest: bounds.getSouthWest(),
      },
    });
  }

  zoomOut = () => {
    this.map.fitBounds(INITIAL_BOUNDS, { padding: 50, linear: true });
  }

  export = () => {
    console.log(map.getCanvas().toDataURL());
  }

  onChangeSelection = selectedTypes => {
    this.map.setFilter(this.state.requestsLayer, this.typeFilter(selectedTypes));
    this.setState({ selectedTypes });
  }

  setRequestsLayer = layerName => {
    if (layerName === 'request-circles') {
      this.map.setLayoutProperty('request-circles', 'visibility', 'visible');
      this.map.setLayoutProperty('request-heatmap', 'visibility', 'none');
      this.setState({ requestsLayer: 'request-circles' });
    } else {
      this.map.setLayoutProperty('request-circles', 'visibility', 'none');
      this.map.setLayoutProperty('request-heatmap', 'visibility', 'visible');
      this.setState({ requestsLayer: 'request-heatmap' });
    }
  }

  selectedRequests = () => {
    const { filterPolygon, requests, selectedTypes } = this.state;

    let filteredRequests = filterPolygon
      ? turf.within(requests, filterPolygon)
      : requests;

    const out = {};

    selectedTypes.forEach(t => out[t] = 0);

    filteredRequests.features.forEach(r => {
      const { type } = r.properties;
      if (typeof out[type] !== 'undefined')
        out[type] += 1;
    });

    return out;
  }

  //// RENDER ////

  render() {
    return (
      <div className="map-container" ref={el => this.mapContainer = el}>
        { this.state.mapReady && (
          <>
            <MapOverview
              regionName={this.state.selectedRegionName}
              selectedRequests={this.selectedRequests()}
            />
            <MapSearch
              map={this.map}
              onGeocoderResult={this.onGeocoderResult}
              onChangeTab={this.onChangeSearchTab}
            />
            <MapLayers
              selectedTypes={this.state.selectedTypes}
              onChange={this.onChangeSelection}
              setRequestsLayer={this.setRequestsLayer}
              requestsLayer={this.state.requestsLayer}
            />
            {/*<MapCharts
              requests={this.state.requests}
              filterPolygon={this.state.filterPolygon}
              selectedTypes={this.state.selectedTypes}
            />*/}
            <MapMeta position={this.props.position} />
          </>
        )}
      </div>
    );
  }
}

const mapDispatchToProps = dispatch => ({
  getPinInfo: srnumber => dispatch(getPinInfoRequest(srnumber)),
  updatePosition: position => dispatch(updateMapPosition(position)),
  exportMap: () => dispatch(trackMapExport()),
});

const mapStateToProps = state => ({
  pinsInfo: state.data.pinsInfo,
  // pinClusters: state.data.pinClusters,
  pinClusters: openRequests,
  heatmap: state.data.heatmap,
  position: state.ui.map
});

PinMap.propTypes = {
  pinsInfo: PropTypes.shape({}),
  pinClusters: PropTypes.arrayOf(PropTypes.shape({})),
  heatmap: PropTypes.arrayOf(PropTypes.array),
  getPinInfo: PropTypes.func.isRequired,
  updatePosition: PropTypes.func.isRequired,
  exportMap: PropTypes.func.isRequired,
};

PinMap.defaultProps = {
  pinsInfo: {},
  pinClusters: [],
  heatmap: [],
};

export default connect(mapStateToProps, mapDispatchToProps)(PinMap);
