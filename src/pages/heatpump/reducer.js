// src/pages/heatpump/reducer.js

export const initialState = {
    ui: {
    useCalculatedFactor: false,
    breakdownView: 'withAux', // 'withAux' or 'noAux'
    activeTab: 'forecast',
    error: null,
    warning: null,
  },
  location: {
    cityName: '',
    stateName: '',
    coords: { latitude: 0, longitude: 0 },
    locationElevation: 0,
    homeElevation: 0,
    foundLocationName: '',
  },
  manual: { manualTemp: 32, manualHumidity: 65 },
  forecast: { data: null, loading: true, error: null },
};

export function reducer(state, action) {
  switch (action.type) {
    case 'SET_UI_FIELD':
      return { ...state, ui: { ...state.ui, [action.field]: action.value } };
    case 'SET_LOCATION_FIELD':
      return { ...state, location: { ...state.location, [action.field]: action.value } };
    case 'SET_LOCATION_COORDS':
      return { ...state, location: { ...state.location, coords: { latitude: action.payload.latitude, longitude: action.payload.longitude } } };
    case 'SET_MANUAL_FIELD':
      return { ...state, manual: { ...state.manual, [action.field]: action.value } };
    case 'FETCH_START':
      return { ...state, forecast: { ...state.forecast, loading: true, error: null } };
    case 'FETCH_SUCCESS':
      return { ...state, forecast: { data: action.payload, loading: false, error: null } };
    case 'FETCH_ERROR':
      return { ...state, forecast: { ...state.forecast, loading: false, error: action.error } };
    default:
      return state;
  }
}
