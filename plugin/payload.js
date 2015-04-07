jQuery.getScript("https://cdn.socket.io/socket.io-1.2.0.js", function (data, status, jqxhr) {

  if ($('#thebutton').length == 0) {
    throw new Error("Not on the button page");
  }

  var socket = io("http://localhost:8080/");

  function now() {
    return new Date().getTime() / 1000;
  }

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
        first_ping: first_ping,
        autoclick: $('#autoclick').is(':checked')
      };

      first_ping = false;

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
    ping();
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

  function beep(){var snd=new Audio("data:audio/wav;base64,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qJrx4KOQjahZxWbcZgztj2c49nKmkId44S71j0c8eV9yDK6uPRzx5X18eDvjvQ6yKo9ZSS6l//8elePK/Lf//IInrOF/FvDoADYAGBMGb7FtErm5MXMlmPAJQVgWta7Zx2go+8xJ0UiCb8LHHdftWyLJE0QIAIsI+UbXu67dZMjmgDGCGl1H+vpF4NSDckSIkk7Vd+sxEhBQMRU8j/12UIRhzSaUdQ+rQU5kGeFxm+hb1oh6pWWmv3uvmReDl0UnvtapVaIzo1jZbf/pD6ElLqSX+rUmOQNpJFa/r+sa4e/pBlAABoAAAAA3CUgShLdGIxsY7AUABPRrgCABdDuQ5GC7DqPQCgbbJUAoRSUj+NIEig0YfyWUho1VBBBA//uQZB4ABZx5zfMakeAAAAmwAAAAF5F3P0w9GtAAACfAAAAAwLhMDmAYWMgVEG1U0FIGCBgXBXAtfMH10000EEEEEECUBYln03TTTdNBDZopopYvrTTdNa325mImNg3TTPV9q3pmY0xoO6bv3r00y+IDGid/9aaaZTGMuj9mpu9Mpio1dXrr5HERTZSmqU36A3CumzN/9Robv/Xx4v9ijkSRSNLQhAWumap82WRSBUqXStV/YcS+XVLnSS+WLDroqArFkMEsAS+eWmrUzrO0oEmE40RlMZ5+ODIkAyKAGUwZ3mVKmcamcJnMW26MRPgUw6j+LkhyHGVGYjSUUKNpuJUQoOIAyDvEyG8S5yfK6dhZc0Tx1KI/gviKL6qvvFs1+bWtaz58uUNnryq6kt5RzOCkPWlVqVX2a/EEBUdU1KrXLf40GoiiFXK///qpoiDXrOgqDR38JB0bw7SoL+ZB9o1RCkQjQ2CBYZKd/+VJxZRRZlqSkKiws0WFxUyCwsKiMy7hUVFhIaCrNQsKkTIsLivwKKigsj8XYlwt/WKi2N4d//uQRCSAAjURNIHpMZBGYiaQPSYyAAABLAAAAAAAACWAAAAApUF/Mg+0aohSIRobBAsMlO//Kk4soosy1JSFRYWaLC4qZBYWFRGZdwqKiwkNBVmoWFSJkWFxX4FFRQWR+LsS4W/rFRb/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////VEFHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAU291bmRib3kuZGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjAwNGh0dHA6Ly93d3cuc291bmRib3kuZGUAAAAAAAAAACU=");snd.play();};

  socket.on('alert', function () {
    var refreshIntervalId = setInterval(function() {
      beep();
    }, 200);

    /* later */
    window.setTimeout(function () {
      clearInterval(refreshIntervalId);
    }, 6000);
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
