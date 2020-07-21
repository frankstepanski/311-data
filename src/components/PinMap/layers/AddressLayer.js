import React from 'react';
import PropTypes from 'prop-types';
import {
  emptyGeo,
  makeGeoCircle,
  makeGeoMask,
  boundingBox
} from '../utils';

const FIT_BOUNDS_PADDING = {
  top: 65,
  bottom: 65,
  left: 300,
  right: 300
};

class AddressLayer extends React.Component {
  init = ({ map, addListeners, onSelectRegion }) => {
    this.map = map;
    this.onSelectRegion = onSelectRegion;
    this.center = null;
    this.offset = null;
    this.circle = null;
    this.canvas = map.getCanvasContainer();

    this.addSources();
    this.addLayers();
    if (addListeners)
      this.addListeners();
  }

  componentDidUpdate(prev) {
    const { visible } = this.props;
    if (visible !== prev.visible)
      this.setVisibility(visible);
  }

  addSources = () => {
    this.map.addSource('shed', {
      type: 'geojson',
      data: null
    });

    this.map.addSource('shed-mask', {
      type: 'geojson',
      data: null
    });
  };

  addLayers = () => {
    const { visible } = this.props;

    this.map.addLayer({
      id: 'shed-border',
      type: 'line',
      source: 'shed',
      layout: {
        visibility: visible ? 'visible' : 'none',
      },
      paint: {
        'line-width': 1.0,
        'line-color': '#FFFFFF',
        // 'line-opacity': [
        //   'interpolate',
        //   ['linear'],
        //   ['zoom'],
        //   10, 1,
        //   13, 0.5
        // ]
      }
    });

    this.map.addLayer({
      id: 'shed-fill',
      type: 'fill',
      source: 'shed',
      layout: {
        visibility: visible ? 'visible' : 'none',
      },
      paint: {
        'fill-color': 'transparent',
      }
    });

    this.map.addLayer({
      id: 'shed-mask-fill',
      type: 'fill',
      source: 'shed-mask',
      layout: {
        visibility: visible ? 'visible' : 'none',
      },
      paint: {
        'fill-color': '#FFFFFF',
        'fill-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10, 0,
          13, 0.2
        ],
      }
    });
  };

  addListeners = () => {
    const onMove = e => {
      this.setCenter({
        lng: e.lngLat.lng - this.offset.lng,
        lat: e.lngLat.lat - this.offset.lat
      });
      this.canvas.style.cursor = 'grabbing';
    };

    const onUp = e => {
      this.selectRegion();
      this.map.off('mousemove', onMove);
      this.map.off('touchmove', onMove);
      this.canvas.style.cursor = '';
    }

    this.map.on('mousedown', 'shed-fill', e => {
      e.preventDefault();
      this.offset = {
        lng: e.lngLat.lng - this.center.lng,
        lat: e.lngLat.lat - this.center.lat,
      };
      this.map.on('mousemove', onMove);
      this.map.once('mouseup', onUp);
      this.canvas.style.cursor = 'grab';
    });

    this.map.on('touchstart', 'shed-fill', e => {
      if (e.points.length !== 1) return;
      e.preventDefault();
      this.map.on('touchmove', onMove);
      this.map.once('touchend', onUp);
    });

    this.map.on('mouseenter', 'shed-fill', e => {
      this.canvas.style.cursor = 'move';
    });

    this.map.on('mouseleave', 'shed-fill', e => {
      this.canvas.style.cursor = '';
    });
  }

  setVisibility = visible => {
    const value = visible ? 'visible' : 'none';
    [
      'shed-border',
      'shed-fill',
      'shed-mask-fill',
    ].forEach(layerId => {
      this.map.setLayoutProperty(layerId, 'visibility', value);
    });
  };

  setCenter = lngLat => {
    if (lngLat) {
      this.center = lngLat;
      this.circle = makeGeoCircle(this.center);
      this.map.getSource('shed').setData(this.circle);
      this.map.getSource('shed-mask').setData(makeGeoMask(this.circle));
    } else {
      this.center = null;
      this.circle = null;
      this.map.getSource('shed').setData(emptyGeo());
      this.map.getSource('shed-mask').setData(emptyGeo());
    }
  };

  zoomTo = lngLat => {
    this.setCenter(lngLat);
    this.map.fitBounds(boundingBox(this.circle), { padding: FIT_BOUNDS_PADDING });
    this.map.once('idle', this.selectRegion);
  };

  selectRegion = () => {
    this.onSelectRegion({
      geo: this.circle,
      center: this.center
    });
  }

  setRadius = miles => {
    console.log('to be implemented');
  }

  render() {
    return null;
  }
}

export default AddressLayer;

AddressLayer.propTypes = {
  visible: PropTypes.bool,
};

AddressLayer.defaultProps = {
  visible: false,
};