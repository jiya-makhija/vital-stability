const margin = { top: 50, right: 40, bottom: 50, left: 60 };
const width = 1100 - margin.left - margin.right;
const height = 400 - margin.top - margin.bottom;

const svg = d3.select("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const tooltip = d3.select("#tooltip");
const x = d3.scaleLinear().domain([0, 1]).range([0, width]);
const y = d3.scaleLinear().range([height, 0]);

svg.append("g").attr("transform", `translate(0,${height})`).attr("class", "x-axis");
svg.append("g").attr("class", "y-axis");

svg.append("text")
  .attr("text-anchor", "middle")
  .attr("x", width / 2)
  .attr("y", height + margin.bottom - 5)
  .attr("class", "axis-label")
  .text("Progress Through Surgery");

  const yLabel = svg.append("text")
  .attr("text-anchor", "middle")
  .attr("transform", `rotate(-90)`)
  .attr("x", -height / 2)
  .attr("y", -margin.left + 15)
  .attr("class", "axis-label");
  
  function updateYAxisLabel() {
  const selectedVital = d3.select("#vitalSelect").property("value");
  yLabel.text(selectedVital === "stability_index" ? "Stability Index" : "Vital Value");
}

const xAxis = d3.axisBottom(x).tickFormat(d3.format(".0%"));
const yAxis = d3.axisLeft(y);
const color = d3.scaleOrdinal(d3.schemeCategory10);

// Load long-format data
d3.csv("data/vitals_long_format_10s.csv", d3.autoType).then(data => {
  const vitalOptions = Array.from(new Set(data.map(d => d.signal)));
  const groupOptions = ["optype", "emop"];

  const vitalSelect = d3.select("#vitalSelect")
    .selectAll("option")
    .data(vitalOptions)
    .enter().append("option")
    .text(d => d.toUpperCase())
    .attr("value", d => d);

  const groupSelect = d3.select("#groupSelect")
    .selectAll("option")
    .data(groupOptions)
    .enter().append("option")
    .text(d => d === "optype" ? "Surgery Type" : "Emergency Status")
    .attr("value", d => d);

  let activeGroups = new Set();

  function updateChart() {
    const selectedVital = d3.select("#vitalSelect").property("value");
    const selectedGroup = d3.select("#groupSelect").property("value");

    const filtered = data.filter(d => d.signal === selectedVital);

    const nested = d3.groups(filtered, d => d[selectedGroup]);

    const summary = nested.map(([key, values]) => {
      const binSize = 0.01;
      const binned = d3.groups(values, d => Math.round(d.norm_time / binSize) * binSize)
        .map(([t, pts]) => {
          const v = pts.map(p => p.value);
          return {
            norm_time: +t,
            mean: d3.mean(v),
            sd: d3.deviation(v),
            value: v[0]
          };
        });
      return { key, values: binned.sort((a, b) => a.norm_time - b.norm_time) };
    });

    const visible = summary.filter(d => activeGroups.size === 0 || activeGroups.has(d.key));

    y.domain([
      d3.min(visible, s => d3.min(s.values, d => d.mean - (d.sd || 0))),
      d3.max(visible, s => d3.max(s.values, d => d.mean + (d.sd || 0)))
    ]);

    svg.select(".x-axis").call(xAxis);
    svg.select(".y-axis").call(yAxis);

    const line = d3.line()
      .x(d => x(d.norm_time))
      .y(d => y(d.mean))
      .curve(d3.curveMonotoneX);

    svg.selectAll(".line").data(visible, d => d.key)
      .join("path")
      .attr("class", "line")
      .attr("fill", "none")
      .attr("stroke", d => color(d.key))
      .attr("stroke-width", 2)
      .attr("d", d => line(d.values));

    const legendContainer = d3.select("#legend");
    legendContainer.html("");
    
    const legendItems = legendContainer.selectAll("div")
      .data(summary.map(d => d.key))
      .enter().append("div")
      .attr("class", "legend-item")
      .style("cursor", "pointer")
      .style("opacity", d => activeGroups.size === 0 || activeGroups.has(d) ? 1 : 0.3)
      .on("click", (event, key) => {
        if (activeGroups.has(key)) {
          activeGroups.delete(key);
        } else {
          activeGroups.add(key);
        }
        updateChart();
      });
    
    legendItems.append("span")
      .attr("class", "legend-color")
      .style("background-color", d => color(d));
    
    legendItems.append("span")
      .attr("class", "legend-label")
      .text(d => d.length > 20 ? d.slice(0, 18) + "…" : d);
  }

  d3.select("#vitalSelect").on("change", updateChart);
  d3.select("#groupSelect").on("change", updateChart);
  d3.select("#vitalSelect").property("value", "stability_index");
  d3.select("#groupSelect").property("value", "optype");
  updateChart();
});