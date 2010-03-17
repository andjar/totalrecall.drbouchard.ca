/* This file is a part of Total Recall, the flash card webapp.
   Copyright Brady Bouchard 2010.
   Available at: http://github.com/brady8/total-recall
   See the README (README.markdown) for more information. */

$(function() {

	var index; // Current card displayed.
	var cards_left_today; // Number of cards left to study today.
	var cards_unlearned; // Cards with an EF < 4.0.
	var $db; // The database (stores easiness factor and next study date).
	var progress; // Progress (percentage) for today.

	$(document).keypress(function(e) {
		switch(e.which) {
			case 32: $('#show-answer').click(); return false; break;
			case 106: $('#1').click(); return false; break;
			case 107: $('#2').click(); return false; break;
			case 108: $('#3').click(); return false; break;
			case 59: $('#5').click(); return false; break;
		}
	});

	function start_it_up() {
		// Are we in 'study' mode?
		if ($('#question-content').length != 0) {
			load_data();
			populate_cards_for_today();
			load_next_card();
			show_reset_button();
		}
	}

	function show_reset_button() {
		$('#reset-database').show();
		$('#reset-database').click(function() {
			$.setItem($set_id, 0);
			$.setItem($set_id + '_progress', 0);
			progress = null;
			$db = null;
			update_progress_bar();
			return false;
		});
	}

	function load_next_card() {
		update_progress_bar();
		index = select_next_card();
		$('#question-content').html($fc[index][0].replace(/\r|\n/gi, "<br />"));
		$('#answer-content').html($fc[index][1].replace(/\r|\n/gi, "<br />"));
		$('#question-box').show();
	}

	function show_answer() {
		$('#question-box').hide();
		$('#answer-box').show();
		return false;
	}

	$('#show-answer').click(function() {
		if($('#answer-box').css('display') == 'none') {
			$('#question-box').hide();
			$('#answer-box').show();
		}
		return false;
	});

	$('.scorebutton').click(function() {
		if($('#answer-box').css('display') == 'none') { return false; }
		$('#answer-box').hide();
		save_card_data(this.id);
		load_next_card();
		return false;
	});

	function populate_cards_for_today() {
		cards_left_today = [];
		cards_unlearned = [];
		if ($db) {
			for(i in $fc) {
				if ($db[i] && $db[i]['next_date']) {
					next_date = new Date(Date.parse($db[i]['next_date']));
					curr_date = new Date();
					if (next_date.toDateString() == curr_date.toDateString())
						cards_left_today.push(parseInt(i));
				} else {
					cards_left_today.push(parseInt(i));
				}
				if ($db[i] && $db[i]['ef']) {
					if ($db[i]['ef'] < 4.0)
						cards_unlearned.push(parseInt(i));
				} else {
					cards_unlearned.push(parseInt(i));
				}
			}
		} else {
			for (i in $fc) {
				cards_left_today.push(parseInt(i));
				cards_unlearned.push(parseInt(i));
			}
		}
	}

	// The next card is selected from cards that need to be reviewed today, as based on the
	// SM2 algorithm. If we're out of cards to review for today, then we choose from any cards
	// that have an easiness factor less than 4. Once that list is exhausted, then we fall back
	// to choosing cards at random.
	function select_next_card() {
 		if (cards_left_today.length == 0) {
			if (cards_unlearned.length == 0) {
 				next_index = Math.floor(Math.random() * $fc.length);
			} else {
				next_index = cards_unlearned[Math.floor(Math.random() * cards_unlearned.length)];
			}
 		} else {
			next_index = cards_left_today[Math.floor(Math.random() * cards_left_today.length)];
		}
		// Don't show the same card twice.
 		while (next_index == index && $fc.length > 1) {
 			next_index = Math.floor(Math.random() * $fc.length);
		}
		return next_index;
	}

	function save_card_data(quality) {
		quality = parseInt(quality);
		if ($db) {
			if (!$db[index]) {
				$db[index] = {'ef' : 2.5, 'next_date' : null, 'reps' : 0, 'interval' : 0 };
			}
			$db[index]['ef'] = parseFloat($db[index]['ef']) + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
			if ($db[index]['ef'] < 1.3) { $db[index]['ef'] = 1.3; }
			if (quality < 3) {
				$db[index]['reps'] = 1;
			} else {
				$db[index]['reps'] += 1;
			}
			interval = calculate_interval($db[index]['reps'], quality, $db[index]['interval']);
			$db[index]['interval'] = interval;
			one_day = 1000 * 60 * 60 * 24;
			next_date = new Date();
			next_date.setTime(next_date.getTime() + one_day * interval);
			$db[index]['next_date'] = next_date.toDateString();
			if (cards_left_today.indexOf(index) != -1) {
				cards_left_today.splice(cards_left_today.indexOf(index), 1);
			}
			if ($db[index]['ef'] >= 4.0) {
				if (cards_unlearned.indexOf(index) != -1) {
					cards_unlearned.splice(cards_unlearned.indexOf(index), 1);
				}
			} else {
				if (cards_unlearned.indexOf(index) == -1) {
					cards_unlearned.push(parseInt(index));
				}
			}
			store_data();
		}
	}

	// SM2 Algorithm for calculating intervals.
	function calculate_interval(reps, q, i) {
		if (reps == 1)
			return 1;
		else if (reps == 2)
			return 6;
		else {
			return (i * q > 60) ? 60 : parseInt(i * q);
		}
	}

	function update_progress_bar() {
		$('#progress-bar').show();
		calculate_progress();
		$('#progress-bar').html(progress + '%');
		$('#debug').html('DB: ' + JSON.stringify($db) + "<br>" +
		'cards_left_today: ' + JSON.stringify(cards_left_today) + "<br>" +
		'cards_unlearned: ' + JSON.stringify(cards_unlearned));
	}

	function store_data() {
		$.setItem($set_id + '_card_counts', [cards_left_today.length, $fc.length]);
		$.setItem($set_id, $db);
	}

	function calculate_progress() {
		if (cards_left_today && cards_left_today.length > 0) {
			progress = parseInt(100 - (100 * (cards_left_today.length / $fc.length)));
		} else if (cards_left_today) {
			progress = 100;
		} else {
			progress = 0;
		}
	}

	function load_data() {
		if (!$db || $db.length == 0) {
			try {
				$db = $.getItem($set_id) || [];
			} catch (SyntaxError) {
				$db = [];
			}
			return;
		}
	}

	start_it_up();

});