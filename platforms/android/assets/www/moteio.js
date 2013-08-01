/*jslint indent: 2 */

var io = io || null,
  localStorage = localStorage || null,
  console = console || null,
  navigator = navigator || null,
  $ = $ || null,
  device = device,
  window = window || null;

var App = function () {

  "use strict";

  var self = this;

  self.remote_location = 'https://localhost:3002';
  //self.remote_location = 'https://mote.io:443';
  self.channel = null;

  self.set = function(key, data) {
    // Put the object into storage
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  }
  self.get = function(key) {
    // Retrieve the object from storage
    var retrievedObject = localStorage.getItem(key);
    if(typeof retrievedObject !== "undefined") {
      return JSON.parse(retrievedObject);
    } else {
      return false;
    }
  }

  self.shush = function () {
    if (self.channel) {
      self.channel.disconnect();
    } else {
      // console.log('not connected to any channels yet');
    }
  };

  self.populateHash = function (given, fallback) {
    if(typeof given !== "undefined" && given) {
      return given;
    }
    return fallback;
  }

  self.renderRemote = function(res) {

    var
      button_id = 0,
      wrapper = null,
      button_size = 0,
      element = null,
      buttons = null;

    if(typeof res == "undefined" || !res) {
      alert('Connected to site but window.moteioConfig is not defined on web page.');
    } else if(typeof res.app_name == "undefined" || !res.app_name) {
      alert('Please supply an app name in the moteioConfig.')
    }

    $('.ui-title').text(res.app_name);
    $('#remote-render').html('');
    var id = 0;

    for(var key in res.blocks) {

      var type = res.blocks[key].type,
      params = res.blocks[key];

      params._id = id;
      id++;

      type = params.type;

      if(type == "notify") {

        wrapper = $('<div class="block"></div>');
        var notify = $('<div class="notify"></div>');

        $('#remote-render').append(wrapper.append(notify).append('<div class="block share" style="display: none;"><div class="buttons"><span class="icon-facebook facebook moteio-button"></span><span class="moteio-button icon-twitter twitter"></span></div></div>'));

      }

      if(type == "buttons") {

        var container = $("<div class='buttons'></div>");

        var i = 0;
        $.each(params.data, function(index, button){

          var data = {
            block_id: params._id,
            _id: i,
            hash: self.populateHash(button.hash, params._id + '_' + i),
            uuid: device.uuid
          }

          var data = self.populateHash(params.hash, data);

          element = $('<span id="moteio-button-' + data.hash + '" class="moteio-button icon-' + button.icon + '" /></span>')
            .bind('vmousedown', function (e) {

              navigator.notification.vibrate(250);
              e.stopPropagation();

              data.press = true;

              self.channel.emit('input', data, function () {
              });

            })
            /*
            element.bind('vmouseup', function (e) {

              navigator.notification.vibrate(250);
              e.stopPropagation();

              data.press = false;

              self.channel.emit('input', data, function () {
              });

            });
            */

            container.append(element);
            i++;
        });

        $('#remote-render').append($('<div class="block"></div>').append(container));
      }

      if(type == "select") {

        var select_html = $('<select class="render-select"></select>');

        for(var option in params.data){
          var option_html = $('<option value="' + option + '" data-paramid="' + params._id + '">' + params.data[option].text + '</option>');
          if(typeof params.data[option].optgroup !== "undefined") {
            if(select_html.find('optgroup[label=' + params.data[option].optgroup + ']').html() == null){
              select_html.append('<optgroup label="' + params.data[option].optgroup + '"></optgroup>')
              select_html.find('optgroup[label=' + params.data[option].optgroup + ']').append(option_html);
            } else {
              select_html.find('optgroup[label=' + params.data[option].optgroup + ']').append(option_html);
            }
          } else {
            select_html.append(option_html);
          }
        }

        select_html.bind('change', function(e) {

          var option_data = $(this).find(":selected").data();

          var data = {
            block_id: option_data.paramid,
            _id: $(this).val(),
            hash: option_data.paramid + '_' + $(this).val(),
            uuid: device.uuid
          }

          self.channel.emit('select', data, function () {

            navigator.notification.vibrate(100);

            setTimeout(function () {
              navigator.notification.vibrate(100);
            }, 150);

          });

        });

        $('#remote-render').append($('<div class="block"></div>').append(select_html));

        $(".render-select").selectmenu();

      }

      if(type == "search") {

        var search_html = $('<form id="remote-search-form" class="block" data-enhance="false"><label for="search-basic" style="display: none">Search Input:</label><input type="search" class="render-search" name="remote-search" id="remote-search" value=""></form>');

        var data = {
          block_id: params._id,
          hash: params._id,
          uuid: device.uuid
        }

        search_html.bind('submit', function(e) {

          data.query =  $("#remote-search-form").val()

          self.channel.emit('search', data, function () {

            navigator.notification.vibrate(100);

            setTimeout(function () {
              navigator.notification.vibrate(100);
            }, 150);

          });

          return false;

        });

        $('#remote-render').append(search_html);

        $('.render-search').textinput();

      }

    }

    buttons = $('.moteio-button');

    $.mobile.changePage($('#remote'));

  };

  self.listen = function () {

    self.channel = io.connect(self.remote_location, {'force new connection': true, 'secure': true});

    self.channel.on('update-config', function (data) {
      console.log('update-config')
      self.renderRemote(data);
      self.channel.emit('got-config');
    });

    self.channel.on('connect_failed', function (reason) {
      alert('Handshake unauthorized.');
      self.logout();
    });

    self.channel.on('disconnect', function() {
      console.log('disconnect');
      // $.mobile.changePage($('#login'));
      // show a status indication
    });

    self.channel.on('connect_failed', function () {
      console.log('connect_failed');
      $.mobile.changePage($('#login'));
    });

    self.channel.on('connecting', function () {
      console.log('connecting')
      //$('#status-message').html('<p>Connecting...</p>');
      //$.mobile.changePage($('#status'));
    });

    self.channel.on('reconnecting', function () {
      console.log('reconnecting');
      $('#status-message').html('<p>Reconnecting...</p>');
      $.mobile.changePage($('#status'));
    });

    self.channel.on('reconnect', function () {
      console.log('reconnect');
      self.channel.emit('get-config');
    });

    self.channel.on('connect', function () {
      console.log('connect');
      self.channel.emit('get-config');
    });

    self.channel.on('notify', function (data) {

      var now_playing = $('.notify');
      now_playing.empty();

      if (typeof data.image !== "undefined") {
        now_playing.append('<img src="' + data.image + '" class="thumb" />');
      }
      if (typeof data.line1 !== "undefined") {
        now_playing.append('<div class="line line-1">' + data.line1 + '</p>');
      }
      if (typeof data.line2 !== "undefined") {
        now_playing.append('<div class="line line-2">' + data.line2 + '</p>');
      }

    });

    self.channel.on('update-button', function(data){

      if(data.icon) {
        $('#moteio-button-' + data.hash).removeClass().addClass('moteio-button icon-' + data.icon);
      }

      if(data.color) {
        $('#moteio-button-' + data.hash).css({
          'color': data.color
        });
      }

    });

    $('.go-home').click(function(){
      self.channel.emit('go-home');
    });

  };

  self.logout = function () {
    $('#remote-render').html('');
    $.mobile.changePage($('#login'));
  }

  self.offline = function() {
  }

  self.init = function () {

    if(navigator.connection.type !== Connection.WIFI && navigator.connection.type !== Connection.ETHERNET) {
      alert('Try connecting to a Wifi network, it makes Mote.io faster!')
    }

    var data = null;

    $("#login-form").submit(function (e) {

      e.preventDefault();

      console.log('login form submit')

      $('#status-message').html('<p>Logging In...</p>');
      $.mobile.changePage($('#status'));

      var data = $(this).serializeArray();

      $.ajaxSetup({
        statusCode: {
          401: function(){
            // Redirec the to the login page.
            alert('Error authorizing.')
            $.mobile.changePage($('#login'));
          }
        }
      });

      $.ajax({
        type: 'post',
        url: self.remote_location + '/post/login',
        data: $(this).serialize(),
        dataType: 'jsonp',
        timeout: 8000,
        success: function(response) {

          if(response.valid) {

            if(data[2].value == "1") {
              self.set('login', data);
            } else {
              self.set('login', null)
            }

            self.listen();

            console.log('waiting for sync')
            $('#status-message').html('<p>Syncing...</p><p>Visit <a>http://mote.io/start</a> on your computer for help.</p>');
            $.mobile.changePage($('#status'));

          } else {
            $.mobile.changePage($('#login'));
            alert(response.reason);
          }

        },
        error: function(xhr, status, err) {

          alert('There was a problem logging you in or the server timed out. Check your username and password.');
          $.mobile.changePage($('#login'));
        }
      });

      return false;

    });

    $('#logout').click(function(){
      self.shush();
      self.logout();
      $.mobile.changePage($('#login'));
    });

    if(self.get('login')) {

      var data = self.get('login')

      $('#username').val(data[0].value)
      $('#password').val(data[1].value)
      $('#remember-me').val('1')
      // $("#login-form").submit();

    }

    $(document).bind("mobileinit", function(){
      $.mobile.defaultPageTransition = 'none';
      $.mobile.defaultDialogTransition = 'none';
      $.mobile.useFastClick = true;
    });

    $.mobile.changePage($('#login'));

  };

};
