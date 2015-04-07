jQuery.getScript("https://cdn.socket.io/socket.io-1.2.0.js", function (data, status, jqxhr) {

  if ($('#thebutton').length == 0) {
    throw new Error("Not on the button page");
  }

  var socket = io("http://localhost:8080/");

  function now() {
    return new Date().getTime() / 1000;
  }

  var lastCheckboxValue = false;
  var first_ping = true;

  function click() {
    //comm delay
    if (r.thebutton._msgSecondsLeft > 10) {
      return;
    }

    $('#thebutton').trigger('click');

    $('.thebutton-form').before(
        $('<h3>You have been ordered to autoclick</h3>').css({
          'text-align': 'center'
        }),
        $('<h3>Your sacrifice will be remembered</h3>').css({
          'text-align': 'center'
        })
    );
  }

  function update(msg) {
    $('#server_timer').text(msg.server_timer);
    $('#autoclickers').text(msg.autoclickers);
    $('#manuals').text(msg.manuals);
    $('#mode').text(msg.mode);

    instance_token = msg.instance_token;

    $('#autoclick').prop('checked', msg.autoclick);

    if (msg.alerted == 'manual') {
      if ($('#click_order').length == 0) {
        $('.thebutton-form').before(
            $('<div/>', {id: 'click_order'}).append(
                $('<h1>Press the button RIGHT NOW</h1>', {id: 'right_now'}).css({
                  'text-align': 'center'
                }),
                $('<h3>Your sacrifice will be remembered</h3>').css({
                  'text-align': 'center'
                })
            )
        );
      }
    }
  }

  function ping() {
    if (r.config.logged) {
      var msg = {
        client_time: now(),
        instance_token: instance_token,
        first_ping: first_ping
      };

      first_ping = false;

      if ($('#autoclick').is(':checked') != lastCheckboxValue) {
        msg.autoclick = $('#autoclick').is(':checked');
        lastCheckboxValue = $('#autoclick').is(':checked');
        console.log('sending ' + msg.autoclick);
      }

      socket.emit('ping', msg);
    }
    if ($('#click_order').length > 0) {
      if ($('.pressed').length == 0) {
        $('#click_order').remove();
      } else {
        $('#right_now').remove();
      }
    }
  }

  var instance_token = 'not_set';

  var button_form = $('.thebutton-form');
  button_form.detach();
  $('.thebutton-wrap').append(
      $('<section id="button_container"/>').css({
        'width': '90%',
        'height': '169px',
        'margin': 'auto',
        'padding': '10px'
      }).append(
          $('<div/>').css({
            'float': 'left',
            'width': '30%',
            'height': '169px'
          }).append(
              $('<div/>').css({
                'position': 'relative',
                'top': '50%',
                'transform': 'translateY(-50%)'
              }).append(
                  $('<p/>').append($('<h3/>').html('The Squire')),
                  $('<p><a href="http://bit.ly/1a7DWwk" target="_blank">what is it?</a></p>'),
                  //$('<p><a onclick="alert(\'dsa\');">what is it?</a></p>'),
                  $('<p>status: <b id="status">connecting...</b></p>'),
                  $('<p>server timer: <b id="server_timer">?</b></p>'),
                  $('<p>autoclickers: <b id="autoclickers">?</b></p>'),
                  $('<p>manuals: <b id="manuals">?</b></p>'),
                  $('<p>mode: <b id="mode">?</b></p>'),
                  $('<p><input id="autoclick" type="checkbox">autoclick</input></p>'),
                  $('<button/>', {
                    onclick: 'window.open(\'https://kiwiirc.com/client/irc.freenode.net/?nick=knight|?#buttonknights\')'
                  }).text('open IRC chat')
              )
          ),
          $('<div/>').css({
            'margin-left': '30%',
            'height': '169px'
          }).append(button_form)
      )
  );
  $('.thebutton-wrap').after(
      $('<div/>').append(
          $('<img/>', {
            src: "http://abra.me:8080/static/plot.png"
          }).css({
            'display': 'block',
            'margin-left': 'auto',
            'margin-right': 'auto'
          })
      )
  );

  $('#autoclick').change(function () {
    client_authoritative = true;
    lastCheckboxValue = $('#autoclick').is(':checked');
  });

  socket.on('connect', function () {
    $('#status').text('online');

    if (r.config.logged) {
      var msg = {
        username: r.config.logged,
        valid: !$('.pressed')[0],
        client_time: now(),
        instance_token: instance_token
      };

      msg.autoclick = $('#autoclick').is(':checked');

      socket.emit('initData', msg);

      window.setInterval(ping, 1000);
    }
  });

  socket.on('announcement', function (msg) {
    alert("ANNOUNCEMENT: " + msg.body);
  });

  socket.on('disconnect', function () {
    $('#status').text('offline');
  });

  socket.on('close', function () {
    socket.disconnect();
  });

  socket.on('multipleClients', function () {
    alert('Having multiple squires open may cause two presses at the same time and labeling you a cheater.');
    socket.disconnect();
  });

  socket.on('reload', function () {
    socket.disconnect();
    location.reload();
  });

  socket.on('update', update);

  socket.on('click', function () {
    click();
  });

  socket.on('alert', function () {
    window.open('https://www.youtube.com/embed/c-EiIQfR-dc?autoplay=1&end=13');
    window.open('https://reddit.com/r/thebutton');
  });

  // failsafe
  window.setTimeout(function () {
    window.setInterval(function () {
      if (r.thebutton._msgSecondsLeft < 3 && $('#autoclick').is(':checked')) {
        click();
      }
    }, 1000);
  }, 10000);

});
