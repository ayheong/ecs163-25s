// variables for dashboard orientation
const width = window.innerWidth;
const height = window.innerHeight;

const unitX = width / 16;
const unitY = height / 16;

const titleHeight = height / 8;
const contentHeight = height - titleHeight;
const halfWidth = width / 2;
const halfHeight = contentHeight / 2;

let pieLeft = 0, pieTop = 0;
let pieMargin = { top: 10, right: 30, bottom: 30, left: 60 },
    pieWidth = 400 - pieMargin.left - pieMargin.right,
    pieHeight = 400 - pieMargin.top - pieMargin.bottom;

// some data processing
d3.csv("data/ds_salaries.csv").then(rawData => {
    console.log("rawData", rawData);

    // Convert to numerical
    rawData.forEach(function (d) {
        d.work_year = Number(d.work_year);
        d.salary = Number(d.salary);
        d.salary_in_usd = Number(d.salary_in_usd);
        d.remote_ratio = Number(d.remote_ratio);
    });

    // Readability
    const experienceMap = {
        EN: "Entry-Level",
        MI: "Mid-Level",
        SE: "Senior",
        EX: "Executive"
    };


    // data processing for pie chart
    const pieCounts = {};
    rawData.forEach(d => {
        d.remote_status =
            d.remote_ratio === 100 ? "Remote" :
                d.remote_ratio === 0 ? "In-Person" : "Hybrid";
        pieCounts[d.remote_status] = (pieCounts[d.remote_status] || 0) + 1;
    });

    const pieData = Object.entries(pieCounts).map(([label, value]) => ({ label, value }));

    // top 10 jobs for parallel coordinates
    const jobCounts = {};
    rawData.forEach(d => {
        jobCounts[d.job_title] = (jobCounts[d.job_title] || 0) + 1;
    });
    const topN = 10;
    const topJobTitles = Object.entries(jobCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN)
        .map(([title]) => title);

    // map for average salaries per job exp level 
    const avgSalaryMap = {};  // key: job|||level → { sum, count }

    rawData.forEach(d => {
        if (!topJobTitles.includes(d.job_title)) return;

        const job = d.job_title;
        const level = experienceMap[d.experience_level] || d.experience_level;
        const key = `${job}|||${level}`;

        if (!avgSalaryMap[key]) avgSalaryMap[key] = { sum: 0, count: 0, job, level };
        avgSalaryMap[key].sum += d.salary_in_usd;
        avgSalaryMap[key].count += 1;
    });

    // filtered data for parallel coords plot
    const filteredData = rawData
        .filter(d =>
            topJobTitles.includes(d.job_title) &&
            d.job_title &&
            d.experience_level &&
            !isNaN(d.salary_in_usd)
        )
        .map(d => ({
            job_title: d.job_title,
            experience_level: experienceMap[d.experience_level] || d.experience_level,
            salary_usd: d.salary_in_usd
        }));

    // create svg
    const svg = d3.select("svg").empty()
        ? d3.select("body").append("svg")
            .attr("width", width)
            .attr("height", height)
        : d3.select("svg");

    // parallel coordinates filter dropdowns
    const filterContainer = d3.select("body")
        .append("div")
        .attr("id", "filters")
        .style("position", "absolute")
        .style("top", "10px")
        .style("right", "20px")
        .style("background", "#f9f9f9")
        .style("padding", "10px")
        .style("border", "1px solid #ccc")
        .style("border-radius", "5px")
        .style("font-size", "12px");

    filterContainer.append("div")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("margin-bottom", "8px")
        .text("Salary Plot Filters");

    // main title
    svg.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", width)
        .attr("height", titleHeight + 30)
        .attr("fill", "#f2f2f2");

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", titleHeight / 2 + 10)
        .attr("text-anchor", "middle")
        .style("font-size", "28px")
        .style("font-weight", "bold")
        .text("Data Science Jobs and Compensation Insights");

    // pie chart
    const pieCenterX = unitX + halfWidth / 4;
    const pieCenterY = titleHeight + unitY + halfHeight / 2;
    const radius = Math.min(halfWidth, halfHeight) / 3;

    // title
    svg.append("text")
        .attr("x", pieCenterX)
        .attr("y", titleHeight + unitY)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .text("Remote Work Ratios (Click Me!)");

    const pie = d3.pie().value(d => d.value);
    const arc = d3.arc().innerRadius(0).outerRadius(radius);

    // pie chart color
    const color = d3.scaleOrdinal()
        .domain(pieData.map(d => d.label))
        .range(["#4E79A7", "#F28E2B", "#E15759"]);

    // hover tooltip
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("z-index", "9999")
        .style("padding", "6px 10px")
        .style("background", "#333")
        .style("color", "#fff")
        .style("border-radius", "4px")
        .style("pointer-events", "none")
        .style("font-size", "13px")
        .style("opacity", 0);

    const pieGroup = svg.append("g")
        .attr("transform", `translate(${pieCenterX}, ${pieCenterY})`);

    let currentSelectedStatus = null;

    // pie slices + mouseover effect
    pieGroup.selectAll("path")
        .data(pie(pieData))
        .enter()
        .append("path")
        .attr("d", arc)
        .attr("fill", d => color(d.data.label))
        .attr("stroke", "#fff")
        .style("stroke-width", "0px")
        .style("cursor", "pointer")
        .on("click", function (d) {
            const selectedStatus = d.data.label;

            if (currentSelectedStatus === selectedStatus) {
                currentSelectedStatus = null;
                updateHistogram(rawData.map(e => e.salary_in_usd));
                histStatusLabel.text("Showing All Positions");
            } else {
                currentSelectedStatus = selectedStatus;
                const filteredSalaries = rawData
                    .filter(e => e.remote_status === selectedStatus)
                    .map(e => e.salary_in_usd);
                updateHistogram(filteredSalaries);
                histStatusLabel.text(`Showing Only ${selectedStatus} Positions`);
            }
        })
        .on("mouseover", function (d) {
            const datum = d.data;
            const percent = ((datum.value / d3.sum(pieData, d => d.value)) * 100).toFixed(1);
            tooltip.transition().duration(200).style("opacity", 0.9);
            tooltip.html(`${datum.label}: ${percent}%`);
            d3.select(this)
                .transition().duration(200)
                .attr("transform", function (d) {
                    const [x, y] = arc.centroid(d);
                    const scale = 1.05;
                    return `translate(${x * (scale - 1)}, ${y * (scale - 1)}) scale(${scale})`;
                })
        })
        .on("mousemove", function () {
            tooltip
                .style("left", (d3.event.pageX + 10) + "px")
                .style("top", (d3.event.pageY - 20) + "px");
        })
        .on("mouseout", function () {
            tooltip.transition().duration(200).style("opacity", 0);
            d3.select(this).transition().duration(200).attr("transform", "translate(0,0) scale(1)");
            d3.select(this)
        });

    // Legend for pie chart
    const legend = svg.append("g")
        .attr("transform", `translate(${pieCenterX + radius + unitX / 2}, ${pieCenterY - radius})`);

    const legendItemSize = 20;
    const legendSpacing = 6;

    const legendItems = legend.selectAll(".legend-item")
        .data(pieData)
        .enter()
        .append("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(0, ${i * (legendItemSize + legendSpacing)})`);

    // boxes
    legendItems.append("rect")
        .attr("width", legendItemSize)
        .attr("height", legendItemSize)
        .attr("fill", d => color(d.label));

    // labels
    legendItems.append("text")
        .attr("x", legendItemSize + 6)
        .attr("y", legendItemSize / 2)
        .attr("dy", "0.35em")
        .style("font-size", "14px")
        .text(d => d.label);

    // Parallel Coordinates plot
    const parallelX = width / 4 + 3 * unitX;
    const parallelWidth = width - parallelX - unitX;
    const parallelCenterX = parallelX + parallelWidth / 2;

    // title
    svg.append("text")
        .attr("x", parallelCenterX)
        .attr("y", titleHeight + unitY)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .text("Salaries by Job and Experience Level (Top 10 Most Frequent Titles)");

    const parallelGroup = svg.append("g")
        .attr("transform", `translate(${parallelX}, ${titleHeight + unitY * 1.5})`);

    const dimensions = ["job_title", "experience_level", "salary_usd"];

    // readability
    filteredData.forEach(d => {
        d.experience_level = experienceMap[d.experience_level] || d.experience_level;
    });

    // ordering
    const orderedDomains = {
        job_title: [...new Set(filteredData.map(d => d.job_title))],
        experience_level: ["Executive", "Senior", "Mid-Level", "Entry-Level"],
    };

    // create y axis scales
    const yScales = {};
    dimensions.forEach(dim => {
        if (dim === "salary_usd") {
            const salaryExtent = d3.extent(filteredData, d => d.salary_usd);
            yScales[dim] = d3.scaleLinear()
                .domain(salaryExtent)
                .range([contentHeight - unitY * 3, 0]);
        } else {
            yScales[dim] = d3.scalePoint()
                .domain(orderedDomains[dim])
                .range([0, contentHeight - unitY * 3]);
        }
    });

    // x axis scale
    const xScale = d3.scalePoint()
        .domain(dimensions)
        .range([0, parallelWidth]);

    // draws lines
    function path(d) {
        return d3.line()(dimensions.map(p => [xScale(p), yScales[p](d[p])]));
    }

    // color scheme for parallel coordinates
    const color2 = d3.scaleOrdinal([
        "#1f77b4",
        "#3182bd",
        "#4a90e2",
        "#2b8cbe",
        "#0570b0",
        "#045a8d",
        "#023858",
        "#6baed6",
        "#74a9cf",
        "#a6bddb"
    ]);

    const jobOptions = ["All", ...orderedDomains.job_title];
    const experienceOptions = ["All", ...orderedDomains.experience_level];

    const filterState = { job_title: "All", experience_level: "All" };

    // add dropdowns for job and experience
    const dropdownDiv = d3.select("#filters");

    dropdownDiv.append("label").text("Job Title: ");
    const jobDropdown = dropdownDiv.append("select");
    jobDropdown.selectAll("option")
        .data(jobOptions)
        .enter()
        .append("option")
        .text(d => d);
    jobDropdown
        .style("color", "#333")
        .style("background-color", "#fff");

    dropdownDiv.append("br");

    dropdownDiv.append("label").text("Experience Level: ");
    const expDropdown = dropdownDiv.append("select");
    expDropdown.selectAll("option")
        .data(experienceOptions)
        .enter()
        .append("option")
        .text(d => d);
    expDropdown
        .style("color", "#333")
        .style("background-color", "#fff");

    dropdownDiv.append("br");
    dropdownDiv.append("br");

    dropdownDiv.append("button")
        .text("Reset Filters")
        .style("padding", "5px 10px")
        .style("background-color", "#e15759")
        .style("color", "#fff")
        .style("border", "none")
        .style("border-radius", "4px")
        .style("cursor", "pointer")
        .on("click", () => {
            // Reset filter state
            filterState.job_title = "All";
            filterState.experience_level = "All";
            salaryBinRange = null;
            selectedBin = null;

            // Reset dropdown selections
            jobDropdown.property("value", "All");
            expDropdown.property("value", "All");

            // Reset histogram colors
            d3.selectAll("rect.bar")
                .transition().duration(300)
                .attr("fill", "#4E79A7");

            // Reset histogram text
            histStatusLabel.text("Showing All Positions");

            // Reset histogram data
            updateHistogram(rawData.map(d => d.salary_in_usd));

            // Reset lines
            updateLines();
        });


    // lines styling + mouseover
    const lines1 = parallelGroup.selectAll(".line-seg1")
        .data(filteredData)
        .enter().append("path")
        .attr("class", "line-seg1")
        .attr("d", d => d3.line()([
            [xScale("job_title"), yScales["job_title"](d.job_title)],
            [xScale("experience_level"), yScales["experience_level"](d.experience_level)]
        ]))
        .attr("fill", "none")
        .attr("stroke", d => color2(d.job_title))
        .attr("stroke-width", 2)
        .style("opacity", 0.5)
        .on("mouseover", function (d) {
            const expOK = filterState.experience_level === "All" || d.experience_level === filterState.experience_level;
            const jobOK = filterState.job_title === "All" || d.job_title === filterState.job_title;
            const salaryOK = !salaryBinRange || (d.salary_usd >= salaryBinRange[0] && d.salary_usd < salaryBinRange[1]);
            const isFilteredIn = expOK && jobOK && salaryOK;

            if (!isFilteredIn) return;

            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(`<strong>${d.experience_level} ${d.job_title}</strong><br>Salary: $${Math.round(d.salary_usd).toLocaleString()}`);

            d3.selectAll(".line-seg1")
                .transition().duration(100)
                .attr("stroke", "#ccc");

            d3.select(this)
                .raise()
                .transition().duration(100)
                .attr("stroke", color2(d.job_title))
                .attr("stroke-width", 5)
                .style("opacity", 1);

            d3.selectAll(".line-seg2")
                .transition().duration(100)
                .attr("stroke", lineD =>
                    (lineD.job_title === d.job_title && lineD.experience_level === d.experience_level)
                        ? color2(d.job_title)
                        : "#ccc"
                )
                .attr("stroke-width", lineD =>
                    (lineD.job_title === d.job_title && lineD.experience_level === d.experience_level)
                        ? 5
                        : 1
                )
                .style("opacity", lineD =>
                    (lineD.job_title === d.job_title && lineD.experience_level === d.experience_level)
                        ? 1
                        : 0.1
                );
        })
        .on("mousemove", function () {
            tooltip
                .style("left", (d3.event.pageX + 10) + "px")
                .style("top", (d3.event.pageY - 20) + "px");
        })
        .on("mouseout", function () {
            tooltip.transition().duration(200).style("opacity", 0);
            updateLines();  // Respect current dropdown + salary filters
        });

    const lines2 = parallelGroup.selectAll(".line-seg2")
        .data(filteredData)
        .enter().append("path")
        .attr("class", "line-seg2")
        .attr("d", d => d3.line()([
            [xScale("experience_level"), yScales["experience_level"](d.experience_level)],
            [xScale("salary_usd"), yScales["salary_usd"](d.salary_usd)]
        ]))
        .attr("fill", "none")
        .attr("stroke", d => color2(d.job_title))
        .attr("stroke-width", 2)
        .style("opacity", 0.5)
        .on("mouseover", function (d) {
            const expOK = filterState.experience_level === "All" || d.experience_level === filterState.experience_level;
            const jobOK = filterState.job_title === "All" || d.job_title === filterState.job_title;
            const salaryOK = !salaryBinRange || (d.salary_usd >= salaryBinRange[0] && d.salary_usd < salaryBinRange[1]);
            const isFilteredIn = expOK && jobOK && salaryOK;

            if (!isFilteredIn) return;

            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(`<strong>${d.experience_level} ${d.job_title}</strong><br>Salary: $${Math.round(d.salary_usd).toLocaleString()}`);

            d3.select(this)
                .raise()
                .transition().duration(100)
                .attr("stroke", color2(d.job_title))
                .attr("stroke-width", 5)
                .style("opacity", 1);

            d3.selectAll(".line-seg2")
                .filter(lineD => lineD !== d)
                .transition().duration(100)
                .style("opacity", lineD => {
                    const expOK = filterState.experience_level === "All" || lineD.experience_level === filterState.experience_level;
                    const jobOK = filterState.job_title === "All" || lineD.job_title === filterState.job_title;
                    const salaryOK = !salaryBinRange || (lineD.salary_usd >= salaryBinRange[0] && lineD.salary_usd < salaryBinRange[1]);
                    return (expOK && jobOK && salaryOK) ? 0.1 : 0;
                })
                .attr("stroke", "#ccc")
                .attr("stroke-width", 1);

            d3.selectAll(".line-seg1")
                .filter(lineD => {
                    const expOK = filterState.experience_level === "All" || lineD.experience_level === filterState.experience_level;
                    const jobOK = filterState.job_title === "All" || lineD.job_title === filterState.job_title;
                    const salaryOK = !salaryBinRange || (lineD.salary_usd >= salaryBinRange[0] && lineD.salary_usd < salaryBinRange[1]);
                    return expOK && jobOK && salaryOK;
                })
                .transition().duration(100)
                .attr("stroke", lineD =>
                    (lineD.job_title === d.job_title && lineD.experience_level === d.experience_level)
                        ? color2(d.job_title)
                        : "#ccc"
                )
                .attr("stroke-width", lineD =>
                    (lineD.job_title === d.job_title && lineD.experience_level === d.experience_level)
                        ? 5
                        : 1
                )
                .style("opacity", lineD =>
                    (lineD.job_title === d.job_title && lineD.experience_level === d.experience_level)
                        ? 1
                        : 0.1
                );
        })
        .on("mousemove", function () {
            tooltip
                .style("left", (d3.event.pageX + 10) + "px")
                .style("top", (d3.event.pageY - 20) + "px");
        })
        .on("mouseout", function () {
            tooltip.transition().duration(200).style("opacity", 0);
            updateLines(); // resets to reflect current filters
        });

    let salaryBinRange = null;

    // update function for dropdown menu
    function updateLines() {
        lines1.transition().duration(500)
            .style("opacity", d => {
                const expOK = filterState.experience_level === "All" || d.experience_level === filterState.experience_level;
                const jobOK = filterState.job_title === "All" || d.job_title === filterState.job_title;
                const salaryOK = !salaryBinRange || (d.salary_usd >= salaryBinRange[0] && d.salary_usd < salaryBinRange[1]);
                return (expOK && jobOK && salaryOK) ? 0.5 : 0;
            })
            .attr("stroke-width", d => {
                const expOK = filterState.experience_level === "All" || d.experience_level === filterState.experience_level;
                const jobOK = filterState.job_title === "All" || d.job_title === filterState.job_title;
                const salaryOK = !salaryBinRange || (d.salary_usd >= salaryBinRange[0] && d.salary_usd < salaryBinRange[1]);
                return (expOK && jobOK && salaryOK) ? 2 : 0;
            })
            .attr("stroke", d => color2(d.job_title));

        lines2.transition().duration(500)
            .style("opacity", d => {
                const expOK = filterState.experience_level === "All" || d.experience_level === filterState.experience_level;
                const jobOK = filterState.job_title === "All" || d.job_title === filterState.job_title;
                const salaryOK = !salaryBinRange || (d.salary_usd >= salaryBinRange[0] && d.salary_usd < salaryBinRange[1]);
                return (expOK && jobOK && salaryOK) ? 0.5 : 0;
            })
            .attr("stroke-width", d => {
                const expOK = filterState.experience_level === "All" || d.experience_level === filterState.experience_level;
                const jobOK = filterState.job_title === "All" || d.job_title === filterState.job_title;
                const salaryOK = !salaryBinRange || (d.salary_usd >= salaryBinRange[0] && d.salary_usd < salaryBinRange[1]);
                return (expOK && jobOK && salaryOK) ? 2 : 0;
            })
            .attr("stroke", d => color2(d.job_title));
    }

    // update graph when dropdown is changed
    expDropdown.on("change", function () {
        filterState.experience_level = this.value;
        updateLines();
    });
    jobDropdown.on("change", function () {
        filterState.job_title = this.value;
        updateLines();
    });

    // Axes
    const axisLabels = {
        job_title: "Job Title",
        experience_level: "Experience Level",
        salary_usd: "Salary (USD)"
    };
    parallelGroup.selectAll(".axis")
        .data(dimensions)
        .enter().append("g")
        .attr("class", "axis")
        .attr("transform", d => `translate(${xScale(d)},0)`)
        .each(function (d) {
            const axis = d3.axisLeft(yScales[d]);
            d3.select(this)
                .call(axis)
                .selectAll("text")
                .style("font-size", "10px")
                .style("font-weight", "bold");
        })
        .append("text")
        .style("text-anchor", "middle")
        .attr("y", -10)
        .text(d => axisLabels[d])
        .style("fill", "black")
        .style("font-size", "10px")
        .style("font-weight", "bold");

    // Histogram
    const histogramX = unitX;
    const histogramY = titleHeight + halfHeight + unitY - 10;

    // title
    svg.append("text")
        .attr("x", pieCenterX)
        .attr("y", histogramY)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .text("Salary Distribution (Click Me!)");

    const histStatusLabel = svg.append("text")
        .attr("x", pieCenterX)
        .attr("y", histogramY + unitY / 4)
        .attr("text-anchor", "middle")
        .style("font-size", "13px")
        .style("fill", "#444")
        .text("Showing All Positions");

    // group for histogram
    const histogramGroup = svg.append("g")
        .attr("transform", `translate(${histogramX}, ${histogramY + unitY / 2})`);

    // data for histogram
    const salaryData = rawData.map(d => d.salary_in_usd);

    // plot location
    const histWidth = halfWidth - unitX * 4;
    const histHeight = halfHeight - unitY * 2;

    // x axis scale
    const xHist = d3.scaleLinear()
        .domain([0, d3.max(salaryData)])
        .range([0, histWidth]);

    // create histogram
    const histogram = d3.histogram()
        .value(d => d)
        .domain(xHist.domain())
        .thresholds(xHist.ticks(20));

    // bins
    const bins = histogram(salaryData);

    // y axis scale
    const yHist = d3.scaleLinear()
        .domain([0, d3.max(bins, d => d.length)])
        .range([histHeight, 0]);

    svg.append("text")
        .attr("x", histogramX + histWidth / 2)
        .attr("y", histogramY + histHeight + unitY)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .text("Salary in USD");

    svg.append("text")
        .attr("transform", `translate(${histogramX - unitX}, ${histogramY - histHeight / 2}) rotate(-90)`)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .text("Count");

    let selectedBin = null;

    // draw
    histogramGroup.selectAll("rect.bar")
        .data(bins)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => xHist(d.x0))
        .attr("y", d => yHist(d.length))
        .attr("width", d => Math.max(0, xHist(d.x1) - xHist(d.x0) - 1))
        .attr("height", d => histHeight - yHist(d.length))
        .attr("fill", "#4E79A7")
        .attr("stroke", "#fff")
        .style("cursor", "pointer")
        .on("click", function (d) {
            if (selectedBin === d) {
                selectedBin = null;
                salaryBinRange = null;
                updateLines();
                d3.selectAll("rect.bar")
                    .transition().duration(300)
                    .attr("fill", "#4E79A7");
            } else {
                selectedBin = d;
                salaryBinRange = [d.x0, d.x1];

                d3.selectAll("rect.bar")
                    .transition().duration(300)
                    .attr("fill", bar => (bar === d ? "#4E79A7" : "#ccc"));
                updateLines();
            }
        });

    // add axes
    histogramGroup.append("g")
        .attr("transform", `translate(0, ${histHeight})`)
        .call(d3.axisBottom(xHist).ticks(10).tickFormat(d3.format("$.2s")));

    histogramGroup.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(yHist).ticks(5));

    // update histogram based off pie chart interaction
    function updateHistogram(newData) {
        const updatedBins = histogram(newData);
        yHist.domain([0, d3.max(updatedBins, d => d.length)]);

        histogramGroup.select(".y-axis")
            .transition().duration(400)
            .call(d3.axisLeft(yHist).ticks(5));

        const bars = histogramGroup.selectAll("rect.bar")
            .data(updatedBins, d => d.x0);

        bars.exit()
            .transition().duration(400)
            .attr("y", histHeight)
            .attr("height", 0)
            .remove();

        const barsEnter = bars.enter()
            .append("rect")
            .attr("class", "bar")
            .attr("x", d => xHist(d.x0))
            .attr("width", d => Math.max(0, xHist(d.x1) - xHist(d.x0) - 1))
            .attr("y", histHeight)
            .attr("height", 0)
            .attr("fill", "#E15759")
            .attr("stroke", "#fff");

        barsEnter.merge(bars)
            .transition().duration(600)
            .attr("x", d => xHist(d.x0))
            .attr("width", d => Math.max(0, xHist(d.x1) - xHist(d.x0) - 1))
            .attr("y", d => yHist(d.length))
            .attr("height", d => histHeight - yHist(d.length));
    }
}).catch(error => {
    console.error("Error loading CSV:", error);
});