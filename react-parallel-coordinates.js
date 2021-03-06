'use strict';

var React = require('react');
var ReactDOM = require('react-dom');
var d3 = require('d3');
var parcoords = require('./parallel-coordinates/d3.parcoords.js');
var PropTypes = require('prop-types');


require('./parallel-coordinates/d3.parcoords.css'); // TODO: find a css solution that refrains from using globals

var createReactClass = require('create-react-class');

var ParallelCoordinatesComponent = createReactClass({
	getDefaultProps: function () {
		return {
			state: { centroids: [], activeData: [] }
		};
	},
	getAdaptiveAlpha: function (data) {
		if (data == undefined)
			return 1;
		var ratio = 100 / data.length;
		return Math.min(1, Math.max(ratio, 0.04));
	},
	onBrushEnd: function (data) {
		this.props.onBrushEnd_data(data)
		this.pc.alpha(this.getAdaptiveAlpha(data)).render()
		this.props.onBrushEnd_extents(this.pc.brushExtents())
		this.recalculateCentroids()
	},
	onBrush: function (data) {
		this.pc.alpha(this.getAdaptiveAlpha(data)).render()
		this.props.onBrush_extents(this.pc.brushExtents())
	},
	isOnLine: function (startPt, endPt, testPt, tol) { // from http://bl.ocks.org/mostaphaRoudsari/b4e090bb50146d88aec4
		// check if test point is close enough to a line
		// between startPt and endPt. close enough means smaller than tolerance
		var x0 = testPt[0];
		var y0 = testPt[1];
		var x1 = startPt[0];
		var y1 = startPt[1];
		var x2 = endPt[0];
		var y2 = endPt[1];
		var Dx = x2 - x1;
		var Dy = y2 - y1;
		var delta = Math.abs(Dy * x0 - Dx * y0 - x1 * y2 + x2 * y1) / Math.sqrt(Math.pow(Dx, 2) + Math.pow(Dy, 2));
		//console.log(delta);
		if (delta <= tol) return true;
		return false;
	},
	findAxes: function (testPt, cenPts) { // from http://bl.ocks.org/mostaphaRoudsari/b4e090bb50146d88aec4
		// finds between which two axis the mouse is
		var x = testPt[0];
		var y = testPt[1];

		// make sure it is inside the range of x
		if (cenPts[0][0] > x) return false;
		if (cenPts[cenPts.length - 1][0] < x) return false;

		// find between which segment the point is
		for (var i = 0; i < cenPts.length; i++) {
			if (cenPts[i][0] > x) return i;
		}
	},
	getLines: function (mousePosition) { // from http://bl.ocks.org/mostaphaRoudsari/b4e090bb50146d88aec4
		var clicked = [];
		var clickedCenPts = [];

		if (this.state === undefined || this.state.centroids.length == 0) return false;

		// find between which axes the point is
		var axeNum = this.findAxes(mousePosition, this.state.centroids[0]);
		if (!axeNum) return false;

		this.state.centroids.forEach(function (d, i) {
			if (this.isOnLine(d[axeNum - 1], d[axeNum], mousePosition, 2)) {
				clicked.push(this.state.activeData[i]);
				clickedCenPts.push(this.state.centroids[i]); // for tooltip
			}
		}.bind(this));

		return [clicked, clickedCenPts]
	},
	hoverLine: function (mousePosition) {

		var linesAndPositions = this.getLines(mousePosition);
		var linesData = linesAndPositions[0];
		if (linesData === undefined) {
			this.props.onLineHover(undefined)
		} else {
			var firstLineData = linesData[0];
			this.props.onLineHover(firstLineData);
		}
	},
	recalculateCentroids: function () {
		// recalculate centroids
		var activeData = this.pc.brushed();
		var centroids = [];
		for (var i = 0; i < activeData.length; i++) {
			centroids[i] = this.pc.compute_real_centroids(activeData[i]);
		}
		this.setState({ centroids: centroids, activeData: activeData })
	},
	/**updatePC sets new brush and new data*/
	updatePC: function () {
		var self = this;

		// no data, only dimensions: do nothing
		var numDimensions = Object.keys(this.props.dimensions).length;
		if (this.props.data === undefined || this.props.data[0] === undefined || numDimensions > this.props.data[0].length) {
			console.log("Not updating: not enough data for " + numDimensions + " dimensions.");
			return;
		}

		// else: set data + brushes

		// keep brush
		var brushExtents = undefined;
		if (this.pc.brushExtents !== undefined) {
			brushExtents = this.pc.brushExtents();
		}
		if (this.props.brushExtents !== undefined)
			brushExtents = this.props.brushExtents; // overwrite current brushExtents with props

		this.pc = this.pc
			.width(this.props.width)
			.height(this.props.height)
			.data(this.props.data) // set data again
			.alpha(self.getAdaptiveAlpha(this.props.data))
			.dimensions(this.props.dimensions)
			.brushMode("1D-axes") // enable brushing
			.color(this.props.colour)
			.unhighlight([])
			.autoscale();

		// use custom domain if it is set
		var dimKeys = Object.keys(this.props.dimensions);
		dimKeys.forEach(
			function (value, index) {
				if (this.props.dimensions[value].hasOwnProperty('domain')) {
					console.log("setting domain", this.props.dimensions[value].domain, "for dimension", this.props.dimensions[value]);
					this.pc = this.pc.scale(value, this.props.dimensions[value].domain)
				}
			}.bind(this)
		)

		// render plot
		this.pc = this.pc
			.composite("source-over") // globalCompositeOperation "darken" may be broken in chrome, "source-over" is boring
			.mode("queue")
			.dimensions(this.props.dimensions)
			.render()
			.shadows()
			.createAxes()
			//.reorderable()
			.on("brushend", function (d) { self.onBrushEnd(d) })
			.on("brush", function (d) { self.onBrush(d) })


		if (this.pc.brushExtents) {
			this.pc = this.pc
				.brushExtents([])
				.brushMode("None") // enable brushing
				.brushMode("1D-axes") // enable brushing

			if (brushExtents !== undefined) {
				this.pc = this.pc
					.brushExtents(brushExtents)
				//.on("brushend", function (d) { self.onBrushEnd(d) })
				//.on("brush", function (d) { self.onBrush(d) })
			}
		}

		// for the mouse-over
		this.recalculateCentroids();
	},
	componentDidMount: function () { // component is now in the DOM

		var self = this;
		var DOMNode = ReactDOM.findDOMNode(this);
		var data = self.props.data;
		var colour = self.props.colour;
		this.pc = d3.parcoords({
			//alpha: 0.2,
			color: "#069",
			shadowColor: "#f3f3f3", // does not exist in current PC version
			width: this.props.width,
			height: this.props.height,
			dimensionTitleRotation: this.props.dimensionTitleRotation,
			margin: { top: 33, right: 0, bottom: 12, left: 0 },
			nullValueSeparator: "bottom",
		})(DOMNode)

		this.pc = this.pc
			.createAxes()
			.render(); // create the svg

		//attach mouse listeners for mouse-over
		d3.select(DOMNode).select('svg')
			.on("mousemove", function () {
				var mousePosition = d3.mouse(this);
				mousePosition[1] = mousePosition[1] - 33; // this is margin top at the moment...
				self.hoverLine(mousePosition)
				//highlightLineOnClick(mousePosition, true); //true will also add tooltip
			})
			.on("mouseout", function () {
				self.props.onLineHover(undefined)
				//cleanTooltip();
				//graph.unhighlight();
			});

		this.updatePC();
		return;
	},
	componentDidUpdate: function () { // update w/ new data http://blog.siftscience.com/blog/2015/4/6/d-threeact-how-sift-science-made-d3-react-besties
		this.updatePC();
		return;
	},/*,
	componentWillUnmount: function () { // clean up
		console.log('componentWillUnmount')
	},*/
	shouldComponentUpdate: function (nextProps, nextState) {
		return (
			/*JSON.stringify(_.map(nextProps.dimensions, function(v,k){return v.title}.bind(this))) !==
				JSON.stringify(_.map(this.props.dimensions, function(v,k){return v.title}.bind(this))) || // update if dimensions changed*/
			JSON.stringify(nextProps.dimensions) !== JSON.stringify(this.props.dimensions) ||
			JSON.stringify(nextProps.data) !== JSON.stringify(this.props.data) || // update if data changed
			JSON.stringify(nextProps.dataHighlighted) !== JSON.stringify(this.props.dataHighlighted) || // update if dataHighlighted changed
			(nextProps.width != this.props.width) ||
			(nextProps.height != this.props.height)
		)
	},
	render: function () {
		var style = {
			width: this.props.width,
			height: this.props.height,
			position: 'relative'
		};
		//return (<div className={'parcoords'} style={style}></div>)
		return React.createElement('div', { className: 'parcoords', style: style });
	}
})

ParallelCoordinatesComponent.propTypes = {
	dimensions: PropTypes.object.isRequired,
	data: PropTypes.array,
	dataHighlighted: PropTypes.array,
	width: PropTypes.number.isRequired,
	height: PropTypes.number.isRequired,
	brushExtents: PropTypes.array,
	onBrush_extents: PropTypes.func,
	onBrushEnd_data: PropTypes.func,
	onBrushEnd_extents: PropTypes.func,
	onLineHover: PropTypes.func,
	colour: PropTypes.func,
	dimensionTitleRotation: PropTypes.number,
}

ParallelCoordinatesComponent.defaultProps = {
	onBrush_extents: function () { },
	onBrushEnd_data: function () { },
	onBrushEnd_extents: function () { },
	onLineHover: function () { },
	colour: function () { return "#000000" },
	dimensionTitleRotation: 0,
}

module.exports = ParallelCoordinatesComponent;
