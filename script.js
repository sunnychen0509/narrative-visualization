(function () {
  "use strict";

  var state = { scene: 0, fuelFilter: "All", cylinderFilter: "All" };
  var data = [];
  var totalScenes = 3;
  var colors = { Gasoline: "#356d8d", Diesel: "#90713a", Electricity: "#3e8b69" };
  var svg = d3.select("#chart");
  var tooltip = d3.select("#tooltip");
  var previousButton = d3.select("#previous-button");
  var nextButton = d3.select("#next-button");

  var sceneCopy = [
    {
      title: "The fleet splits into two worlds",
      description: "City and highway efficiency move together, but fuel type creates the clearest separation. Gasoline and diesel vehicles cluster in the lower-left, while electric vehicles occupy a much higher MPGe range.",
      takeaway: "<strong>First message:</strong> fuel type explains the largest visible divide in the 2017 fleet."
    },
    {
      title: "Among gasoline cars, cylinders carry a cost",
      description: "Removing electric vehicles reveals a second pattern. As cylinder count rises, average city fuel economy generally falls. Larger engines may offer more power, but they demand more fuel in city driving.",
      takeaway: "<strong>Core message:</strong> the average 8-cylinder gasoline vehicle travels substantially fewer city miles per gallon than the average 4-cylinder vehicle."
    },
    {
      title: "Now explore the trade-off yourself",
      description: "The author-guided portion is complete. Use the filters to isolate a fuel type or cylinder count, and hover over circles to inspect individual manufacturer averages.",
      takeaway: "<strong>Exploration:</strong> test whether the overall pattern still holds for the subset you choose."
    }
  ];

  d3.csv("cars2017.csv", function (error, rows) {
    if (error) {
      d3.select("#chart-status").text("The data file could not be loaded. Run the project from a web server or GitHub Pages.");
      return;
    }

    data = rows.map(function (d) {
      return {
        make: d.Make,
        fuel: d.Fuel,
        cylinders: +d.EngineCylinders,
        highway: +d.AverageHighwayMPG,
        city: +d.AverageCityMPG
      };
    });

    populateCylinderFilter();
    connectTriggers();
    d3.select("#chart-status").classed("is-hidden", true);
    renderScene();
  });

  function populateCylinderFilter() {
    var cylinders = d3.set(data.map(function (d) { return String(d.cylinders); }))
      .values().map(Number).sort(d3.ascending);

    d3.select("#cylinder-filter")
      .selectAll("option.cylinder-option")
      .data(cylinders)
      .enter().append("option")
      .attr("class", "cylinder-option")
      .attr("value", function (d) { return d; })
      .text(function (d) { return d === 0 ? "0 (electric)" : d + " cylinders"; });
  }

  function connectTriggers() {
    previousButton.on("click", function () {
      if (state.scene > 0) { state.scene -= 1; renderScene(); }
    });

    nextButton.on("click", function () {
      if (state.scene < totalScenes - 1) { state.scene += 1; renderScene(); }
    });

    d3.select("#fuel-filter").on("change", function () {
      state.fuelFilter = this.value;
      updateExploreScene();
    });

    d3.select("#cylinder-filter").on("change", function () {
      state.cylinderFilter = this.value;
      updateExploreScene();
    });

    d3.select("#reset-filters").on("click", function () {
      state.fuelFilter = "All";
      state.cylinderFilter = "All";
      d3.select("#fuel-filter").property("value", "All");
      d3.select("#cylinder-filter").property("value", "All");
      updateExploreScene();
    });

    d3.select(window).on("keydown", function () {
      if (d3.event.keyCode === 37 && state.scene > 0) {
        state.scene -= 1; renderScene();
      } else if (d3.event.keyCode === 39 && state.scene < totalScenes - 1) {
        state.scene += 1; renderScene();
      }
    });
  }

  function renderScene() {
    tooltip.classed("is-visible", false).attr("aria-hidden", "true");
    svg.selectAll("*").remove();
    svg.node().__explore = null;
    updateSceneCopy();
    updateProgress();
    updateNavigation();

    if (state.scene === 0) { drawOverviewScene(); }
    else if (state.scene === 1) { drawCylinderScene(); }
    else { drawExploreScene(); }
  }

  function updateSceneCopy() {
    var scene = sceneCopy[state.scene];
    d3.select("#scene-number").text("Scene " + (state.scene + 1) + " of " + totalScenes);
    d3.select("#scene-title").text(scene.title);
    d3.select("#scene-description").text(scene.description);
    d3.select("#takeaway").html(scene.takeaway);
    d3.select("#explore-controls").attr("hidden", state.scene === 2 ? null : true);
  }

  function updateProgress() {
    d3.selectAll(".progress-step")
      .classed("active", function () { return +this.getAttribute("data-step") === state.scene; })
      .classed("complete", function () { return +this.getAttribute("data-step") < state.scene; });
  }

  function updateNavigation() {
    previousButton.attr("disabled", state.scene === 0 ? true : null);
    nextButton.attr("disabled", state.scene === totalScenes - 1 ? true : null)
      .text(state.scene === 1 ? "Explore data →" : (state.scene === 2 ? "Story complete" : "Next scene →"));

    d3.select("#navigation-hint").text(
      state.scene === 2
        ? "The final scene is open for free-form exploration."
        : "Use the Next button or arrow keys to continue the author-guided story."
    );
  }

  function chartFrame(title, subtitle) {
    var outerWidth = 860;
    var outerHeight = 590;
    var margin = { top: 74, right: 38, bottom: 68, left: 76 };
    var width = outerWidth - margin.left - margin.right;
    var height = outerHeight - margin.top - margin.bottom;

    svg.attr("viewBox", "0 0 " + outerWidth + " " + outerHeight)
      .attr("preserveAspectRatio", "xMidYMid meet");

    svg.append("text").attr("class", "chart-title")
      .attr("x", margin.left).attr("y", 32).text(title);
    svg.append("text").attr("class", "chart-subtitle")
      .attr("x", margin.left).attr("y", 52).text(subtitle);

    return {
      group: svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")"),
      width: width,
      height: height
    };
  }

  function drawOverviewScene() {
    var frame = chartFrame(
      "2017 city and highway efficiency by fuel type",
      "Each circle is a manufacturer / engine configuration; circle size reflects cylinder count."
    );
    var x = d3.scale.log().domain([10, 160]).range([0, frame.width]);
    var y = d3.scale.log().domain([10, 160]).range([frame.height, 0]);

    drawScatterAxes(frame, x, y, "Average city MPG / MPGe", "Average highway MPG / MPGe");
    drawLegend(frame.group, frame.width - 155, 8);

    frame.group.selectAll("circle.point")
      .data(data).enter().append("circle")
      .attr("class", "point")
      .attr("cx", function (d) { return x(d.city); })
      .attr("cy", function (d) { return y(d.highway); })
      .attr("r", function (d) { return 4 + Math.min(d.cylinders, 12) * 0.45; })
      .style("fill", function (d) { return colors[d.fuel]; });

    drawAnnotation(frame.group, {
      targetX: x(24),
      targetY: y(31),
      boxX: frame.width - 350,
      boxY: frame.height - 190,
      width: 330,
      title: "City and highway ratings move together",
      body: [
        "Most vehicles with stronger city",
        "efficiency also rank higher on highways."
      ]
    });
  }

  function drawCylinderScene() {
    var frame = chartFrame(
      "Average city MPG for gasoline vehicles",
      "Bars show the mean for each cylinder count; labels below show the number of observations."
    );
    var gasoline = data.filter(function (d) { return d.fuel === "Gasoline"; });
    var nested = d3.nest()
      .key(function (d) { return d.cylinders; })
      .rollup(function (values) {
        return { average: d3.mean(values, function (d) { return d.city; }), count: values.length };
      })
      .entries(gasoline)
      .map(function (d) { return { cylinders: +d.key, average: d.values.average, count: d.values.count }; })
      .sort(function (a, b) { return d3.ascending(a.cylinders, b.cylinders); });

    var x = d3.scale.ordinal()
      .domain(nested.map(function (d) { return d.cylinders; }))
      .rangeBands([0, frame.width], 0.28);
    var y = d3.scale.linear().domain([0, 40]).range([frame.height, 0]);

    frame.group.append("g").attr("class", "grid")
      .call(d3.svg.axis().scale(y).orient("left").ticks(5).tickSize(-frame.width)
        .tickFormat(function () { return ""; }));
    frame.group.append("g").attr("class", "axis")
      .attr("transform", "translate(0," + frame.height + ")")
      .call(d3.svg.axis().scale(x).orient("bottom"));
    frame.group.append("g").attr("class", "axis")
      .call(d3.svg.axis().scale(y).orient("left").ticks(5));

    frame.group.append("text").attr("class", "axis-label")
      .attr("x", frame.width / 2).attr("y", frame.height + 52)
      .style("text-anchor", "middle").text("Engine cylinders");
    frame.group.append("text").attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -frame.height / 2).attr("y", -52)
      .style("text-anchor", "middle").text("Average city MPG");

    frame.group.selectAll("rect.bar")
      .data(nested).enter().append("rect")
      .attr("class", "bar")
      .attr("x", function (d) { return x(d.cylinders); })
      .attr("width", x.rangeBand())
      .attr("y", frame.height).attr("height", 0)
      .transition().duration(650)
      .attr("y", function (d) { return y(d.average); })
      .attr("height", function (d) { return frame.height - y(d.average); });

    frame.group.selectAll("text.bar-label")
      .data(nested).enter().append("text")
      .attr("class", "bar-label")
      .attr("x", function (d) { return x(d.cylinders) + x.rangeBand() / 2; })
      .attr("y", function (d) { return y(d.average) - 9; })
      .text(function (d) { return d.average.toFixed(1); });

    frame.group.selectAll("text.sample-label")
      .data(nested).enter().append("text")
      .attr("class", "sample-label")
      .attr("x", function (d) { return x(d.cylinders) + x.rangeBand() / 2; })
      .attr("y", frame.height + 29)
      .text(function (d) { return "n=" + d.count; });

    var four = nested.filter(function (d) { return d.cylinders === 4; })[0];
    var eight = nested.filter(function (d) { return d.cylinders === 8; })[0];
    var decline = (1 - eight.average / four.average) * 100;

    drawAnnotation(frame.group, {
      targetX: x(8) + x.rangeBand() / 2,
      targetY: y(eight.average),
      boxX: frame.width - 315, boxY: 42, width: 278,
      title: "The 4-to-8 cylinder drop",
      body: [
        "4 cylinders: " + four.average.toFixed(1) + " city MPG",
        "8 cylinders: " + eight.average.toFixed(1) + " city MPG",
        "That is about " + decline.toFixed(0) + "% lower."
      ]
    });
  }

  function drawExploreScene() {
    var frame = chartFrame(
      "Explore city and highway efficiency",
      "Filters and hover tooltips are enabled in this final, free-form scene."
    );
    var x = d3.scale.log().domain([10, 160]).range([0, frame.width]);
    var y = d3.scale.log().domain([10, 160]).range([frame.height, 0]);
    drawScatterAxes(frame, x, y, "Average city MPG / MPGe", "Average highway MPG / MPGe");
    drawLegend(frame.group, frame.width - 155, 8);
    frame.group.append("g").attr("class", "explore-points");
    frame.group.append("g").attr("class", "explore-annotation");
    svg.node().__explore = { frame: frame, x: x, y: y };
    updateExploreScene();
  }

  function updateExploreScene() {
    if (state.scene !== 2 || !svg.node().__explore) { return; }
    var context = svg.node().__explore;
    var filtered = data.filter(function (d) {
      var fuelMatch = state.fuelFilter === "All" || d.fuel === state.fuelFilter;
      var cylinderMatch = state.cylinderFilter === "All" || d.cylinders === +state.cylinderFilter;
      return fuelMatch && cylinderMatch;
    });

    var points = context.frame.group.select("g.explore-points")
      .selectAll("circle.point")
      .data(filtered, function (d) { return [d.make, d.fuel, d.cylinders, d.city, d.highway].join("-"); });

    points.exit().transition().duration(250).attr("r", 0).remove();

    points.enter().append("circle")
      .attr("class", "point")
      .attr("cx", function (d) { return context.x(d.city); })
      .attr("cy", function (d) { return context.y(d.highway); })
      .attr("r", 0)
      .style("fill", function (d) { return colors[d.fuel]; })
      .on("mouseover", showTooltip)
      .on("mousemove", moveTooltip)
      .on("mouseout", hideTooltip);

    context.frame.group.select("g.explore-points").selectAll("circle.point")
      .transition().duration(350)
      .attr("cx", function (d) { return context.x(d.city); })
      .attr("cy", function (d) { return context.y(d.highway); })
      .attr("r", function (d) { return 4 + Math.min(d.cylinders, 12) * 0.45; })
      .style("fill", function (d) { return colors[d.fuel]; });

    var annotationLayer = context.frame.group.select("g.explore-annotation");
    annotationLayer.selectAll("*").remove();

    if (filtered.length) {
      var avgCity = d3.mean(filtered, function (d) { return d.city; });
      var avgHighway = d3.mean(filtered, function (d) { return d.highway; });
      drawAnnotation(annotationLayer, {
        targetX: context.x(avgCity), targetY: context.y(avgHighway),
        boxX: 28, boxY: 28, width: 270,
        title: "Current filtered selection",
        body: [
          filtered.length + " vehicle configurations",
          "Average city: " + avgCity.toFixed(1),
          "Average highway: " + avgHighway.toFixed(1)
        ]
      });
    } else {
      drawAnnotation(annotationLayer, {
        targetX: context.frame.width / 2, targetY: context.frame.height / 2,
        boxX: context.frame.width / 2 - 135, boxY: 35, width: 270,
        title: "No matching vehicles",
        body: ["Change one of the filters", "to restore data points."]
      });
    }
  }

  function drawScatterAxes(frame, x, y, xLabel, yLabel) {
    var ticks = [10, 20, 50, 100, 150];
    var blank = function () { return ""; };
    var tickText = function (d) { return d; };

    frame.group.append("g").attr("class", "grid")
      .attr("transform", "translate(0," + frame.height + ")")
      .call(d3.svg.axis().scale(x).orient("bottom").tickValues(ticks)
        .tickSize(-frame.height).tickFormat(blank));
    frame.group.append("g").attr("class", "grid")
      .call(d3.svg.axis().scale(y).orient("left").tickValues(ticks)
        .tickSize(-frame.width).tickFormat(blank));
    frame.group.append("g").attr("class", "axis")
      .attr("transform", "translate(0," + frame.height + ")")
      .call(d3.svg.axis().scale(x).orient("bottom").tickValues(ticks).tickFormat(tickText));
    frame.group.append("g").attr("class", "axis")
      .call(d3.svg.axis().scale(y).orient("left").tickValues(ticks).tickFormat(tickText));

    frame.group.append("text").attr("class", "axis-label")
      .attr("x", frame.width / 2).attr("y", frame.height + 52)
      .style("text-anchor", "middle").text(xLabel);
    frame.group.append("text").attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -frame.height / 2).attr("y", -54)
      .style("text-anchor", "middle").text(yLabel);
  }

  function drawLegend(group, x, y) {
    var fuels = ["Gasoline", "Diesel", "Electricity"];
    var legend = group.append("g").attr("class", "legend")
      .attr("transform", "translate(" + x + "," + y + ")");
    var row = legend.selectAll("g").data(fuels).enter().append("g")
      .attr("transform", function (d, i) { return "translate(0," + (i * 21) + ")"; });
    row.append("circle").attr("r", 5).style("fill", function (d) { return colors[d]; });
    row.append("text").attr("x", 11).attr("y", 4).text(function (d) { return d; });
  }

  function drawAnnotation(layer, options) {
    var lineHeight = 16;
    var boxHeight = 38 + options.body.length * lineHeight;
    var boxCenterX = options.boxX + options.width / 2;
    var boxCenterY = options.boxY + boxHeight / 2;
    var elbowX = options.targetX + (boxCenterX - options.targetX) * 0.45;
    var annotation = layer.append("g").attr("class", "annotation");

    annotation.append("path").attr("class", "annotation-line")
      .attr("d", "M" + options.targetX + "," + options.targetY +
        " L" + elbowX + "," + options.targetY +
        " L" + boxCenterX + "," + boxCenterY);
    annotation.append("circle").attr("class", "annotation-target")
      .attr("cx", options.targetX).attr("cy", options.targetY).attr("r", 4);
    annotation.append("rect").attr("class", "annotation-box")
      .attr("x", options.boxX).attr("y", options.boxY)
      .attr("width", options.width).attr("height", boxHeight)
      .attr("rx", 8).attr("ry", 8);
    annotation.append("text").attr("class", "annotation-title")
      .attr("x", options.boxX + 13).attr("y", options.boxY + 20)
      .text(options.title);

    var body = annotation.append("text").attr("class", "annotation-body")
      .attr("x", options.boxX + 13).attr("y", options.boxY + 40);
    options.body.forEach(function (line, index) {
      body.append("tspan")
        .attr("x", options.boxX + 13)
        .attr("dy", index === 0 ? 0 : lineHeight)
        .text(line);
    });
  }

  function showTooltip(d) {
    var unit = d.fuel === "Electricity" ? "MPGe" : "MPG";
    tooltip.html(
      "<strong>" + d.make + "</strong>" +
      d.fuel + " · " + (d.cylinders === 0 ? "electric" : d.cylinders + " cylinders") + "<br>" +
      "City: " + d.city + " " + unit + "<br>" +
      "Highway: " + d.highway + " " + unit
    ).classed("is-visible", true).attr("aria-hidden", "false");
    moveTooltip();
  }

  function moveTooltip() {
    tooltip.style("left", d3.event.clientX + "px").style("top", d3.event.clientY + "px");
  }

  function hideTooltip() {
    tooltip.classed("is-visible", false).attr("aria-hidden", "true");
  }
}());
