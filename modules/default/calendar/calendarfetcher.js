/* Magic Mirror
 * Node Helper: Calendar - CalendarFetcher
 *
 * By Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 */

var ical = require("./vendor/ical.js");
var moment = require("moment");

var CalendarFetcher = function(url, reloadInterval, maximumEntries, maximumNumberOfDays) {
	var self = this;

	var reloadTimer = null;
	var events = [];

	var fetchFailedCallback = function() {};
	var eventsReceivedCallback = function() {};

	/* fetchCalendar()
	 * Initiates calendar fetch.
	 */
	var fetchCalendar = function() {

		clearTimeout(reloadTimer);
		reloadTimer = null;

		ical.fromURL(url, {}, function(err, data) {
			if (err) {
				fetchFailedCallback(self, err);
				scheduleTimer();
				return;
			}

			//console.log(data);
			newEvents = [];

			var limitFunction = function(date, i) {return i < maximumEntries;};

			for (var e in data) {
				var event = data[e];
				var now = new Date();
				var today = moment().startOf("day").toDate();
				var future = moment().startOf("day").add(maximumNumberOfDays, "days").subtract(1,"seconds").toDate(); // Subtract 1 second so that events that start on the middle of the night will not repeat.

				

				// FIXME:
				// Ugly fix to solve the facebook birthday issue.
				// Otherwise, the recurring events only show the birthday for next year.
				var isFacebookBirthday = false;
				if (typeof event.uid !== "undefined") {
					if (event.uid.indexOf("@facebook.com") !== -1) {
						isFacebookBirthday = true;
					}
				}

				if (event.type === "VEVENT") {

					var startDate = (event.start.length === 8) ? moment(event.start, "YYYYMMDD") : moment(new Date(event.start));
					var endDate;
					if (typeof event.end !== "undefined") {
						endDate = (event.end.length === 8) ? moment(event.end, "YYYYMMDD") : moment(new Date(event.end));
					} else {
						endDate = startDate;
					}

					if (event.start.length === 8) {
						startDate = startDate.startOf("day");
					}

					if (typeof event.rrule != "undefined" && !isFacebookBirthday) {
						var rule = event.rrule;
						var dates = rule.between(today, future, true, limitFunction);

						for (var d in dates) {
							startDate = moment(new Date(dates[d]));
							newEvents.push({
								title: (typeof event.summary.val !== "undefined") ? event.summary.val : event.summary,
								startDate: startDate.format("x"),
								endDate: endDate.format("x"),
								fullDayEvent: isFullDayEvent(event)
							});
						}
					} else {
						// console.log("Single event ...");
						// Single event.
						var fullDayEvent = isFullDayEvent(event);
						var title = (typeof event.summary.val !== "undefined") ? event.summary.val : event.summary;

						if (!fullDayEvent && endDate < new Date()) {
							//console.log("It's not a fullday event, and it is in the past. So skip: " + title);
							continue;
						}

						if (fullDayEvent && endDate < today) {
							//console.log("It's a fullday event, and it is before today. So skip: " + title);
							continue;
						}

						if (startDate > future) {
							//console.log("It exceeds the maximumNumberOfDays limit. So skip: " + title);
							continue;
						}

						// Every thing is good. Add it to the list.					
						newEvents.push({
							title: title,
							startDate: startDate.format("x"),
							endDate: endDate.format("x"),
							fullDayEvent: fullDayEvent
						});
						
					}
				}
			}

			newEvents.sort(function(a, b) {
				return a.startDate - b.startDate;
			});

			events = newEvents.slice(0, maximumEntries);

			self.broadcastEvents();
			scheduleTimer();
		});
	};

	/* scheduleTimer()
	 * Schedule the timer for the next update.
	 */
	var scheduleTimer = function() {
		//console.log('Schedule update timer.');
		clearTimeout(reloadTimer);
		reloadTimer = setTimeout(function() {
			fetchCalendar();
		}, reloadInterval);
	};

	/* isFullDayEvent(event)
	 * Checks if an event is a fullday event.
	 *
	 * argument event obejct - The event object to check.
	 *
	 * return bool - The event is a fullday event.
	 */
	var isFullDayEvent = function(event) {
		if (event.start.length === 8) {
			return true;
		}

		var start = event.start || 0;
		var startDate = new Date(start);
		var end = event.end || 0;

		if (end - start === 24 * 60 * 60 * 1000 && startDate.getHours() === 0 && startDate.getMinutes() === 0) {
			// Is 24 hours, and starts on the middle of the night.
			return true;			
		}

		return false;
	};

	/* public methods */

	/* startFetch()
	 * Initiate fetchCalendar();
	 */
	this.startFetch = function() {
		fetchCalendar();
	};

	/* broadcastItems()
	 * Broadcast the exsisting events.
	 */
	this.broadcastEvents = function() {
		//console.log('Broadcasting ' + events.length + ' events.');
		eventsReceivedCallback(self);
	};

	/* onReceive(callback)
	 * Sets the on success callback
	 *
	 * argument callback function - The on success callback.
	 */
	this.onReceive = function(callback) {
		eventsReceivedCallback = callback;
	};

	/* onError(callback)
	 * Sets the on error callback
	 *
	 * argument callback function - The on error callback.
	 */
	this.onError = function(callback) {
		fetchFailedCallback = callback;
	};

	/* url()
	 * Returns the url of this fetcher.
	 *
	 * return string - The url of this fetcher.
	 */
	this.url = function() {
		return url;
	};

	/* events()
	 * Returns current available events for this fetcher.
	 *
	 * return array - The current available events for this fetcher.
	 */
	this.events = function() {
		return events;
	};

};


module.exports = CalendarFetcher;