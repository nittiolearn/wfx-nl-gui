nreport = function() {
	//#############################################################################################
	// Draw charts
	//#############################################################################################


function _renderBarChart(chartContainer, jsonData, det){
	
	var barWidth = 17;
	var width = 292 ;
	var height = 175;
	var heightPadding = 20;
	var xmarginPadding = 25

	var scaledX = d3.scale.ordinal().domain(jsonData.map(function(datum){return datum.label;})).rangeBands([xmarginPadding, width -15]);
	var scaledY = d3.scale.linear().domain([0, d3.max(jsonData, function(datum) { return datum.value; })]).rangeRound([height -heightPadding, 5]);

		
	var svgContainer = d3.select(chartContainer.get(0)).append("svg:svg").attr("width", width).attr("height", height);	
	var barChart = svgContainer.append("g").attr("width", width).attr("height", height).attr("class","barchart");
		
	var xAxis = d3.svg.axis().scale(scaledX).orient("bottom");
	var yAxis = d3.svg.axis().scale(scaledY).orient("left").ticks(4).tickFormat(d3.format("d"));
	
	barChart.append("g").attr("class", "axis").attr("transform", "translate(" + 0 + "," + (height - heightPadding) + ")").call(xAxis);
	barChart.append("g").attr("class", "axis").attr("transform", "translate(" + xmarginPadding + ",0)").call(yAxis);
	
	var filteredjsonData = jsonData.filter(function(datum){return datum.value > 0;});
	
	var rectGroup = barChart.selectAll("rectGroup").data(filteredjsonData).enter().append("g").attr("class","rectGroup");
		
	rectGroup.append("svg:rect").attr("x", function(datum, index) { return scaledX(datum.label) + 3;}).attr("y", function(datum) { return scaledY(datum.value); }).
	  attr("height", function(datum) { return (height - scaledY(datum.value) - heightPadding); }).attr("width", barWidth).
	  attr("fill", "#6666FF");
	  
	rectGroup.append("svg:text").attr("x", function(datum, index) { return scaledX(datum.label) + barWidth + 3 ; }).attr("y", function(datum) { return scaledY(datum.value); }).
	  attr("dx", -barWidth/2).attr("dy", "1.2em").attr("text-anchor", "middle").
	  text(function(datum) { return datum.value;}).
	  attr("fill", "white").
	  attr("class", "yAxisValue");
	rectGroup.append("svg:title").text(function(datum){return datum.value + " " + det;});
	 

}

function _renderPieChart(chartContainer, jsonData){
		
		var width = 400;
    	var height = 200;
    	var radius = Math.min(width, height) / 2;
    	
    	var arc = d3.svg.arc().outerRadius(radius - 10).innerRadius(0);		
		var pie = d3.layout.pie().sort(null).value(function(d) { return d.value; }); 				
    	var color = d3.scale.ordinal().range(["#2d578b","#FF0000"]);
    	    				
    	var pieChart = d3.select(chartContainer.get(0)).append("svg:svg").attr("width", width).attr("height", height);    	
    	var pieGroup = pieChart.append("g").attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");    					
    	var arc_group = pieGroup.selectAll("arc").data(pie(jsonData)).enter().append("g").attr("class", "arc");      					
      	arc_group.append("path").attr("stroke","white").attr("stroke-width",0.5).attr("d", arc).style("fill", function(d) { return color(d.value); });
      	arc_group.append("text").attr("transform", function(d) { return "translate(" + arc.centroid(d) + ")"; })
				.attr("dy", ".35em")
				.style("text-anchor", "middle")
				.text(function(d) { return d.value; });				
		
		pieChart.selectAll("rect").data(jsonData).enter().append("svg:rect").attr("x", 300).attr("y", function(datum, index){return (30 + index* 20 );}). attr("height", 15). attr("width", 15).attr("fill", function(datum) { return color(datum.label); });
		pieChart.selectAll("text.legend").data(jsonData).enter().append("svg:text").attr("x", 320).attr("y", function(datum, index){return (45 + index* 20 );}). text(function(datum){return datum.label;}).attr("fill", "#000000").attr("class","legend");
}


function _renderprogressBar(chartContainer, jsonData){
	
	var width = 160;
	var height = 15;
	var fullBarwidth = width - 40;		
	var scaledX = d3.scale.linear().domain([0, 100]).range([0, fullBarwidth]);	
	var progressBar = d3.select(chartContainer.get(0)).append("svg:svg").attr("width", width).attr("height", height);
	progressBar.append("svg:rect").attr("x", 0).attr("y", 0).attr("width", fullBarwidth).attr("height", height).attr("fill", "#FF0000");	
	progressBar.selectAll("rect.pbar").
	  data(jsonData).
	  enter().
	  append("svg:rect").attr("x", 0).attr("y", 0).attr("width", function(datum){return scaledX(datum.value);}).attr("height", height).attr("fill", "#00CC00").attr("class","pbar");
	  
	progressBar.selectAll("text").
	  data(jsonData).
	  enter().
	  append("svg:text").attr("x", fullBarwidth + 5).attr("y", height - 3 ).
	  attr("text-anchor", "right").
	  text(function(datum) { return datum.value + '%';}).
	 attr("fill", "#000066");
	    	
}


/* Not tested yet */
function _renderScatterChart(chartContainer, jsonData){
	
	var width = 300;
	var height = 175;
    
    var x = d3.scale.ordinal().domain(jsonData.map(function(datum){return datum.label;})).rangeBands([20, width-20]);
    
    var y = d3.scale.linear().domain([0, d3.max(jsonData, function(datum) { return datum.value; })]).
  			rangeRound([height -20, 5]);

 
    var scatterChart = d3.select(chartContainer.get(0)).append('svg:svg').attr('width', width ).attr('height', height).attr('class', 'scatterchart')
    var main = scatterChart.append('g').attr('width', width).attr('height', height).attr('class', 'main') 

    var xAxis = d3.svg.axis().scale(x).orient('bottom');
    main.append("g").attr("class", "axis").attr("transform", "translate(0," + (height - 20) + ")").call(xAxis);    
    var yAxis = d3.svg.axis().scale(y).orient('left').ticks(5);
    main.append("g").attr("class", "axis").attr("transform", "translate(" + 20 + ",0)").call(yAxis);
    var g = main.append("svg:g");
    
    g.selectAll("scatter-dots")
      .data(jsonData)
      .enter().append("svg:circle")
          .attr("cx", function (d,i) { return x(d.label) + 20; } )
          .attr("cy", function (d) { return  y(d.value) - 20; } )
          .attr("r", 4);
}


	//---------------------------------------------------------------------------------------------
	// Exposed Functions
	//---------------------------------------------------------------------------------------------


function init() {
		
	var charts = $('.chart');

	charts.each( function() {
		var chartContainer = $(this);
		var data = chartContainer.html();
		var jsonData = JSON.parse(data).chart;
		chartContainer.html('');
		if( chartContainer.hasClass('bar') == true){
			var det = chartContainer.attr('tooltipdetails');
					
			_renderBarChart(chartContainer,jsonData, det);	
		}else if (chartContainer.hasClass('pie') == true) {
			_renderPieChart(chartContainer,jsonData);
		}else if (chartContainer.hasClass('scatter') == true) {
			_renderScatterChart(chartContainer,jsonData);
		}else if (chartContainer.hasClass('progressBar') == true){
			_renderprogressBar(chartContainer, jsonData);
		}
		
	});
}

return {
		init : init
	};		
}(); 