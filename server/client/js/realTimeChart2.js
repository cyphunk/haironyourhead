














// USED UP TWO HOURS ON THIS . SWITCHING TO CANVAS


















<!-- Author: Bo Ericsson, bo@boe.net -->
<!-- Inspiration from numerous examples by Mike Bostock, http://bl.ocks.org/mbostock, -->
<!-- and example by Andy Aiken, http://blog.scottlogic.com/2014/09/19/interactive.html -->
'use strict';

function realTimeChart() {

  var version = "0.1.0",
      datum, initialData, data,
      maxSeconds = 300, pixelsPerSecond = 10,
      svgWidth = 700, svgHeight = 300,
      margin = { top: 20, bottom: 20, left: 50, right: 30, topNav: 10, bottomNav: 20 },
      dimension = { chartTitle: 20, xAxis: 20, yAxis: 20, xTitle: 20, yTitle: 20, navChart: 70 },
      barWidth = 3,
      maxY = 100, minY = 0,
      chartTitle, yTitle, xTitle,
      drawXAxis = true, drawYAxis = true, drawNavChart = true,
      border,
      selection,
      barId = 0;

  // create the chart
  var chart = function(s) {
    selection = s;
    if (selection == undefined) {
      console.error("selection is undefined");
      return;
    };

    // process titles
    chartTitle = chartTitle || "";
    xTitle = xTitle || "";
    yTitle = yTitle || "";

    // compute component dimensions
    var chartTitleDim = chartTitle == "" ? 0 : dimension.chartTitle;
    var xTitleDim = xTitle == "" ? 0 : dimension.xTitle;
    var yTitleDim = yTitle == "" ? 0 : dimension.yTitle;
    var xAxisDim = !drawXAxis ? 0 : dimension.xAxis;
    var yAxisDim = !drawYAxis ? 0 : dimension.yAxis;
    var navChartDim = !drawNavChart ? 0 : dimension.navChart;

    // compute chart dimension and offset
    var marginTop = margin.top + chartTitleDim;
    var height = svgHeight - marginTop - margin.bottom - chartTitleDim - xTitleDim - xAxisDim - navChartDim + 30;
    var heightNav = navChartDim - margin.topNav - margin.bottomNav;
    var marginTopNav = svgHeight - margin.bottom - heightNav - margin.topNav;
    var width = svgWidth - margin.left - margin.right;
    var widthNav = width;



    data = initialData || [];
    var n = 40;
    // var random = d3.random.normal(0, .2);
    // data = d3.range(n).map(random);

    var n = 40;
    var svg = d3.select("svg"),
        g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    var x = d3.scale.linear()
        .domain([0, n - 1])
        .range([0, width]);
    var y = d3.scale.linear()
        .domain([-1, 1])
        .range([height, 0]);
    var line = d3.svg.line()
        .x(function(d, i) { return x(i); })
        .y(function(d, i) { return y(d); });
    g.append("defs").append("clipPath")
        .attr("id", "clip")
      .append("rect")
        .attr("width", width)
        .attr("height", height);
    g.append("g")
        .attr("class", "axis axis--x")
        .attr("transform", "translate(0," + y(0) + ")")
        // .call(d3.axisBottom(x));
    g.append("g")
        .attr("class", "axis axis--y")
        // .call(d3.axisLeft(y));
    g.append("g")
        .attr("clip-path", "url(#clip)")
      .append("path")
        .datum(data)
        .attr("class", "line")
      .transition()
        .duration(500)
        // .ease(d3.easeLinear)
        // .on("start", tick);
    function tick() {
      // Push a new data point onto the back.
      data.push(random());
      // Redraw the line.
      d3.select(this)
          .attr("d", line)
          .attr("transform", null);
      // Slide it to the left.
      d3.active(this)
          .attr("transform", "translate(" + x(-1) + ",0)")
        .transition()
      // Pop the old data point off the front.
      data.shift();
    }





















    // function to keep the chart "moving" through time (right to left)
    // setInterval(function() {
    //
    //   // get current viewport extent
    //   var extent = viewport.empty() ? xNav.domain() : viewport.extent();
    //   var interval = extent[1].getTime() - extent[0].getTime();
    //   var offset = extent[0].getTime() - xNav.domain()[0].getTime();
    //
    //   // compute new nav extents
    //   endTime = new Date();
    //   startTime = new Date(endTime.getTime() - maxSeconds * 1000);
    //
    //   // compute new viewport extents
    //   startTimeViewport = new Date(startTime.getTime() + offset);
    //   endTimeViewport = new Date(startTimeViewport.getTime() + interval);
    //   viewport.extent([startTimeViewport, endTimeViewport])
    //
    //   // update scales
    //   x.domain([startTimeViewport, endTimeViewport]);
    //   xNav.domain([startTime, endTime]);
    //
    //   // update axis
    //   xAxis.scale(x)(xAxisG);
    //   xAxisNav.scale(xNav)(xAxisGNav);
    //
    //   // refresh svg
    //   refresh();
    //
    // }, 200)

    // end setInterval function

    return chart;

  } // end chart function


  // chart getter/setters

  // array of inital data
  chart.initialData = function(_) {
    if (arguments.length == 0) return initialData;
    initialData = _;
    return chart;
  }

  // new data item (this most recent item will appear
  // on the right side of the chart, and begin moving left)
  chart.datum = function(_) {
    if (arguments.length == 0) return datum;
    datum = _;
    data.push(datum);
    return chart;
  }

  // svg width
  chart.width = function(_) {
    if (arguments.length == 0) return svgWidth;
    svgWidth = _;
    return chart;
  }

  // svg height
  chart.height = function(_) {
    if (arguments.length == 0) return svgHeight;
    svgHeight = _;
    return chart;
  }

  // svg border
  chart.border = function(_) {
    if (arguments.length == 0) return border;
    border = _;
    return chart;
  }

  // chart title
  chart.title = function(_) {
    if (arguments.length == 0) return chartTitle;
    chartTitle = _;
    return chart;
  }

  // x axis title
  chart.xTitle = function(_) {
    if (arguments.length == 0) return xTitle;
    xTitle = _;
    return chart;
  }

  // y axis title
  chart.yTitle = function(_) {
    if (arguments.length == 0) return yTitle;
    yTitle = _;
    return chart;
  }

  // bar width
  chart.barWidth = function(_) {
    if (arguments.length == 0) return barWidth;
    barWidth = _;
    return chart;
  }

  // version
  chart.version = version;

  return chart;

} // end realTimeChart function
