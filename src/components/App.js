import React, { Component } from 'react';
import { connect } from 'react-redux';
import './App.css';
import _ from 'lodash';
import * as actions from '../actions';
import Portfolio from './Portfolio';
import stockData from '../data/securities.json';

class App extends Component { 
  render() {
    const data = _.filter(stockData, (row) => {
      return true;
      const d = new Date(row.date);
      return (d.getFullYear() <= 2010);
    })
    return (
      <div className="App">
        <Portfolio stockData={data} />
      </div>
    );
  }
}

export default connect(
  state => ({
    status: state.status,
  }),
  actions
)(App);
