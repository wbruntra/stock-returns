import React, { Component } from 'react';
import axios from 'axios';
import { connect } from 'react-redux';
import _ from 'lodash';
import * as actions from '../actions';
// import 'react-vis/dist/style.css';
// import { XYPlot, LineSeries, XAxis, YAxis } from 'react-vis';
import * as am4core from '@amcharts/amcharts4/core';
import * as am4charts from '@amcharts/amcharts4/charts';
import am4themes_animated from '@amcharts/amcharts4/themes/animated';

am4core.useTheme(am4themes_animated);

const getPortfolioValue = (prices, holdings) => {
  let cashValue = _.reduce(
    holdings,
    (result, value, key) => {
      const nextValue = prices[key] * value || 0;
      return result + nextValue;
    },
    0
  );
  return cashValue + holdings.cash;
};

const getReturnsForPeriods = (history, weeks) => {
  let best = {
    startDate: '',
    endDate: '',
    pct: 0,
  };
  let worst = {
    startDate: '',
    endDate: '',
    pct: 0,
  };
  const result = history.slice(0, history.length - weeks).map((row, i) => {
    const returnPct = (history[i + weeks].value - row.value) / row.value;
    if (returnPct > best.pct) {
      best.startDate = row.date;
      best.endDate = history[i + weeks].date;
      best.pct = returnPct;
    }
    if (returnPct < worst.pct) {
      worst.startDate = row.date;
      worst.endDate = history[i + weeks].date;
      worst.pct = returnPct;
    }
    return returnPct;
  });

  const initial = history[0].value;
  const final = _.last(history).value;

  const totalReturn = final / initial;

  const weeklyReturn = Math.pow(final / initial, 1 / (history.length - 1));
  const annualReturn = Math.pow(weeklyReturn, 52) - 1;

  return {
    best,
    worst,
    annualReturn,
  };
};

class Portfolio extends Component {
  constructor(props) {
    super(props);

    this.state = {
      stocks: 0.5,
      bonds: 0.5,
      cash: 0,
      initialValue: 10000,
      rebalancing: true,
      showPct: false,
      weeksPeriod: 26,
      weeksInput: 26,
    };
  }

  componentDidMount = () => {
    const { history, data } = this.updateHistory();
    let chart = am4core.create('chartdiv', am4charts.XYChart);

    // let data = [];
    // let visits = 10;
    // for (let i = 1; i < 366; i++) {
    //   visits += Math.round((Math.random() < 0.5 ? 1 : -1) * Math.random() * 10);
    //   data.push({ date: new Date(2018, 0, i), name: "name" + i, value: visits });
    // }

    chart.data = data;

    let dateAxis = chart.xAxes.push(new am4charts.DateAxis());
    dateAxis.renderer.grid.template.location = 0;

    let valueAxis = chart.yAxes.push(new am4charts.ValueAxis());
    // valueAxis.logarithmic = true;
    valueAxis.tooltip.disabled = true;
    valueAxis.renderer.minWidth = 35;
    // valueAxis.max = 50000;

    let series = chart.series.push(new am4charts.LineSeries());
    series.dataFields.dateX = 'date';
    series.dataFields.valueY = 'value';

    series.tooltipText = '${valueY.value}';
    chart.cursor = new am4charts.XYCursor();

    let scrollbarX = new am4charts.XYChartScrollbar();
    scrollbarX.series.push(series);
    // scrollbarX.events.on("dragstop", (e) => {
    //   console.log(e);
    // })
    chart.scrollbarX = scrollbarX;

    // chart.addListener("zoomed", (e) => {
    //   const chart = e.chart,
    //       data = chart.dataProvider,
    //       zoomedData = data.slice(e.startIndex, e.endIndex + 1);
    //       console.log(zoomedData);
    // });


    this.chart = chart;
  };

  componentDidUpdate(prevProps, prevState) {
    if (JSON.stringify(this.state) !== JSON.stringify(prevState)) {
      this.updateChart();
    }
  }

  componentWillUnmount() {
    if (this.chart) {
      this.chart.dispose();
    }
  }

  updateChart = _.debounce(() => {
    const { history, data } = this.updateHistory();
    this.chart.data = data;
  }, 400);

  updateHistory = () => {
    const { showPct, initialValue, rebalancing } = this.state;
    const history = this.createHistory();
    const data = history.map((row, i) => {
      const value = showPct ? row.pctChange : row.value;
      return {
        date: new Date(row.date),
        value,
      };
    });
    return {
      history,
      data,
    };
    // this.setState({
    //   history,
    //   data,
    // });
  };

  rebalanceHoldings = (prices, holdings) => {
    const { stocks } = this.state;
    const currentValue = getPortfolioValue(prices, holdings);
    const newHoldings = this.calculateHoldings(currentValue, prices);
    return newHoldings;
  };

  calculateHoldings = (netWorth, prices) => {
    const { stocks, bonds } = this.state;
    const holdings = {};
    holdings.SPY = Math.floor((stocks * netWorth) / prices.SPY);
    holdings.LQD = Math.floor((bonds * netWorth) / prices.LQD);
    let totalValue = holdings.LQD * prices.LQD + holdings.SPY * prices.SPY;
    const cash = netWorth - totalValue;
    return {
      ...holdings,
      cash,
    };
  };

  createHistory = () => {
    const { initialValue, stocks: pctStocks, rebalancing } = this.state;
    const { stockData } = this.props;
    let counter = 1;
    const history = [];
    const initial = stockData[0];
    let holdings = this.calculateHoldings(initialValue, initial);
    history.push({
      date: initial.date,
      value: getPortfolioValue(initial, holdings),
      pctChange: 1,
    });
    stockData.slice(1).forEach(prices => {
      const newValue = getPortfolioValue(prices, holdings);
      const pctChange = newValue / initialValue;
      if (rebalancing && counter % 2 === 0) {
        holdings = this.rebalanceHoldings(prices, holdings);
        // console.log(holdings.SPY);
      }
      history.push({
        date: prices.date,
        value: _.round(newValue, 2),
        pctChange,
      });
      counter++;
    });
    return history;
  };

  createTable = () => {
    const history = this.createHistory();
    return (
      <table className="striped">
        <thead>
          <tr>
            <th>Date</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {history.map(row => {
            return (
              <tr key={row.date}>
                <td>{row.date}</td>
                <td>{`$${row.value}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  handleSubmit = e => {
    e.preventDefault();
    if (document && document.activeElement) document.activeElement.blur();
  };

  handleInputChange = event => {
    const target = event.target;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    const name = target.name;

    this.setState({
      [name]: value,
    });
  };

  handleAllocationChange = e => {
    const name = e.target.name;
    const newPct = Number(e.target.value) / 10;
    let otherPct = _.round(1 - newPct, 1);
    this.setState(prevState => {
      let change;
      const { bonds, stocks, cash } = prevState;
      switch (name) {
        case 'stocks':
          change = newPct - stocks;
          if (change <= bonds) {
            otherPct = _.round(bonds - change, 1);
          } else {
            otherPct = 0;
          }
          return {
            stocks: newPct,
            bonds: otherPct,
            cash: _.round(1 - (newPct + otherPct), 1),
          };
        case 'bonds':
          change = newPct - bonds;
          if (change <= cash) {
            otherPct = cash - change;
          } else {
            otherPct = 0;
          }
          return {
            stocks: _.round(1 - (newPct + otherPct), 1),
            bonds: newPct,
            cash: _.round(otherPct, 1),
          };
        case 'cash':
          change = newPct - cash;
          if (change <= stocks) {
            otherPct = _.round(stocks - change, 1);
          } else {
            otherPct = 0;
          }
          return {
            stocks: otherPct,
            bonds: _.round(1 - (newPct + otherPct), 1),
            cash: newPct,
          };
        default:
          return {
            stocks,
            bonds,
            cash,
          };
      }
    });
  };

  render() {
    const {
      stocks,
      bonds,
      cash,
      showPct,
      weeksPeriod,
    } = this.state;

    const { history, data } = this.updateHistory();

    if (_.isEmpty(history)) {
      return null;
    }
    const records = getReturnsForPeriods(history, weeksPeriod);
    const final = _.last(history);
    return (
      <div className="container">
        <form onSubmit={this.handleSubmit}>
          <div className="row">
            <div className="col s6">
              <label>
                Stocks {`${stocks * 100}%`}
                <input
                  name="stocks"
                  type="range"
                  min="0"
                  max="10"
                  value={10 * stocks}
                  onChange={this.handleAllocationChange}
                />
              </label>
              <label>
                Bonds {`${bonds * 100}%`}
                <input
                  name="bonds"
                  type="range"
                  min="0"
                  max="10"
                  value={10 * bonds}
                  onChange={this.handleAllocationChange}
                />
              </label>
              <label>
                Cash {`${cash * 100}%`}
                <input
                  name="cash"
                  type="range"
                  min="0"
                  max="10"
                  value={10 * cash}
                  onChange={this.handleAllocationChange}
                />
              </label>
            </div>
            <div className="col s6">
              <p>
                <label>
                  <input
                    name="rebalancing"
                    type="checkbox"
                    checked={this.state.rebalancing ? 'checked' : ''}
                    onChange={this.handleInputChange}
                  />
                  <span>Include Rebalancing</span>
                </label>
              </p>
              {/* <p>
                <label>
                  <input
                    name="showPct"
                    type="checkbox"
                    checked={showPct ? 'checked' : ''}
                    onChange={this.handleInputChange}
                  />
                  <span>Show By Percent</span>
                </label>
              </p> */}

              <div className="col s12">
                Evaluation Period (weeks):
                <div className="input-field inline">
                  <input
                    type="text"
                    className="center-align"
                    value={this.state.weeksInput}
                    onChange={e => {
                      this.setState({
                        weeksInput: e.target.value,
                      });
                    }}
                    onBlur={() => {
                      const weeksPeriod =
                        Number(eval(this.state.weeksInput)) || 26;
                      this.setState({
                        weeksPeriod,
                      });
                    }}
                  />{' '}
                </div>
              </div>
              <input type="submit" hidden />
            </div>
          </div>
        </form>
        <pre>
          Final Value: {`$${final.value}`} <br />
          Average 52-week Return: {`${_.round(100 * records.annualReturn, 2)}%`}
          <br />
          {/* Date: {displayDate} <br />
          Value: {displayValue} <br /> */}
          Best {weeksPeriod}-week: {records.best.startDate} to{' '}
          {records.best.endDate} ({`${_.round(100 * records.best.pct, 1)}%`})
          <br />
          Worst {weeksPeriod}-week: {records.worst.startDate} to{' '}
          {records.worst.endDate} ({`${_.round(100 * records.worst.pct, 1)}%`})
          <br />
        </pre>
        <div id="chartdiv" style={{ width: '100%', height: '500px' }} />
        {/* {false && (
          <div className="row">
            <div className="col s8">
              <XYPlot
                yDomain={showPct ? [0.8, 4.5] : [5000, 45000]}
                xType="time"
                yType={showPct ? 'linear' : 'log'}
                margin={{ left: 100, right: 100 }}
                height={400}
                width={1000}
              >
                <XAxis />
                <YAxis />
                <LineSeries
                  data={data}
                  onNearestX={(datapoint, event) => {
                    this.setState({
                      displayDate: datapoint.x.toDateString(),
                      displayValue: datapoint.y,
                    });
                  }}
                />
              </XYPlot>
            </div>
          </div>
        )} */}
        {/* <button onClick={this.updateHistory}>Update</button> */}
      </div>
    );
  }
}

export default connect(
  state => ({
    status: state.status,
  }),
  actions
)(Portfolio);
